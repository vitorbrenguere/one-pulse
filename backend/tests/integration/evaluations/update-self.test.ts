import { beforeEach, describe, expect, it } from 'vitest';
import { insertHierarchy, type Hierarchy } from '../../helpers/db.js';
import {
  evaluationsApi,
  expectMissingForSubmit,
  findEvaluationRowById,
  insertEvaluation,
  ISO_UTC_PATTERN,
  LOCKED_BODY,
  SEEDED_TIMESTAMP_ISO,
  type EvaluationsApi,
} from '../../helpers/evaluations.js';
import { expectError } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';

describe('PATCH /api/v1/evaluations/:id (avaliado: autoavaliação)', () => {
  const ctx = useIntegrationContext();
  let h: Hierarchy;
  let api: EvaluationsApi;

  beforeEach(async () => {
    h = await insertHierarchy(ctx.pool);
    api = evaluationsApi(ctx.app);
  });

  const rowOf = (id: number) => findEvaluationRowById(ctx.pool, id);

  it('[EVAL-25] avaliado salva rascunho (com trim), e null limpa cada campo preservando o outro', async () => {
    const seeded = await insertEvaluation(ctx.pool, { userId: h.C1.id, managerId: h.G.id });

    const draft = await api.update(h.C1, seeded.id, { selfScore: 4, selfComments: '  Entreguei a API.  ' });

    expect(draft.status).toBe(200);
    expect(Object.keys(draft.body)).toEqual(['evaluation']);
    expect(draft.body.evaluation).toMatchObject({
      id: seeded.id,
      status: 'ABERTA',
      selfScore: 4,
      selfComments: 'Entreguei a API.',
      selfSubmittedAt: null,
      createdAt: SEEDED_TIMESTAMP_ISO,
    });
    expect(Date.parse(draft.body.evaluation.updatedAt)).toBeGreaterThan(Date.parse(SEEDED_TIMESTAMP_ISO));
    expect(await rowOf(seeded.id)).toMatchObject({ self_score: 4, self_comments: 'Entreguei a API.', self_submitted_at: null });

    const noComments = await api.update(h.C1, seeded.id, { selfComments: null });

    expect(noComments.status).toBe(200);
    expect(noComments.body.evaluation).toMatchObject({ selfScore: 4, selfComments: null });

    const noScore = await api.update(h.C1, seeded.id, { selfScore: null });

    expect(noScore.status).toBe(200);
    expect(noScore.body.evaluation).toMatchObject({ selfScore: null, selfComments: null });
    expect(await rowOf(seeded.id)).toMatchObject({ self_score: null, self_comments: null });
  });

  it('[EVAL-26] { submit: true } envia o rascunho salvo (sem comentário: é opcional) → selfSubmittedAt preenchido', async () => {
    const seeded = await insertEvaluation(ctx.pool, { userId: h.C1.id, managerId: h.G.id, selfScore: 3 });
    const before = Date.now();

    const res = await api.update(h.C1, seeded.id, { submit: true });

    expect(res.status).toBe(200);
    expect(res.body.evaluation).toMatchObject({ status: 'ABERTA', selfScore: 3, selfComments: null });
    expect(res.body.evaluation.selfSubmittedAt).toMatch(ISO_UTC_PATTERN);
    // DATETIME não guarda milissegundos: tolerância de 1s.
    expect(Date.parse(res.body.evaluation.selfSubmittedAt)).toBeGreaterThanOrEqual(before - 1000);
    expect((await rowOf(seeded.id))?.self_submitted_at).toBeInstanceOf(Date);
  });

  it('[EVAL-26] preencher e enviar no mesmo PATCH', async () => {
    const seeded = await insertEvaluation(ctx.pool, { userId: h.C1.id, managerId: h.G.id });

    const res = await api.update(h.C1, seeded.id, { selfScore: 5, selfComments: 'Semestre forte.', submit: true });

    expect(res.status).toBe(200);
    expect(res.body.evaluation).toMatchObject({ status: 'ABERTA', selfScore: 5, selfComments: 'Semestre forte.' });
    expect(res.body.evaluation.selfSubmittedAt).toMatch(ISO_UTC_PATTERN);
  });

  it.each([
    ['rascunho sem nota', { selfComments: 'Só texto.' }, { submit: true }],
    ['nota limpa no mesmo payload do envio', { selfScore: 4 }, { selfScore: null, submit: true }],
  ])('[EVAL-27] envio com %s → 400 em selfScore; nada muda', async (_d, draft, body) => {
    const seeded = await insertEvaluation(ctx.pool, { userId: h.C1.id, managerId: h.G.id, ...draft });
    const before = await rowOf(seeded.id);

    const res = await api.update(h.C1, seeded.id, body);

    expectMissingForSubmit(res, ['selfScore']);
    expect(await rowOf(seeded.id)).toEqual(before);
  });

  it.each([
    ['editar o comentário', { selfComments: 'Mudei de ideia.' }],
    ['trocar a nota', { selfScore: 5 }],
    ['reenviar a MESMA nota', { selfScore: 4 }],
    ['enviar de novo', { submit: true }],
  ])('[EVAL-28] autoavaliação já enviada: %s → 409 EVALUATION_LOCKED; nada muda', async (_d, body) => {
    const seeded = await insertEvaluation(ctx.pool, {
      userId: h.C1.id,
      managerId: h.G.id,
      selfScore: 4,
      selfSubmitted: true,
    });
    const before = await rowOf(seeded.id);

    const res = await api.update(h.C1, seeded.id, body);

    expect(res.status).toBe(409);
    expect(res.body).toEqual(LOCKED_BODY);
    expect(await rowOf(seeded.id)).toEqual(before);
  });

  it.each([
    ['managerScore', { managerScore: 5 }],
    ['managerFeedback', { managerFeedback: 'Eu mesmo me elogio.' }],
    ['payload misto', { selfScore: 4, managerScore: 5 }],
    ['parte do gestor com submit', { managerScore: 5, submit: true }],
  ])('[EVAL-29] avaliado envia campo do gestor (%s) → 403 FORBIDDEN; nada muda', async (_d, body) => {
    const seeded = await insertEvaluation(ctx.pool, { userId: h.C1.id, managerId: h.G.id });
    const before = await rowOf(seeded.id);

    const res = await api.update(h.C1, seeded.id, body);

    expectError(res, 403, 'FORBIDDEN');
    expect(await rowOf(seeded.id)).toEqual(before);
  });
});
