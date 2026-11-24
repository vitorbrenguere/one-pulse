import { beforeEach, describe, expect, it } from 'vitest';
import { FORBIDDEN_UPDATE_FIELDS, INVALID_UPDATE_BODIES } from '../../fixtures/evaluations.fixtures.js';
import { insertHierarchy, type Hierarchy } from '../../helpers/db.js';
import {
  EVALUATION_NOT_FOUND_BODY,
  evaluationsApi,
  expectMissingForSubmit,
  expectValidationErrorOn,
  findEvaluationRowById,
  insertEvaluation,
  insertManagerOf,
  ISO_UTC_PATTERN,
  LOCKED_BODY,
  NONEXISTENT_ID,
  type EvaluationsApi,
  type InsertEvaluationOptions,
  type SeededEvaluation,
} from '../../helpers/evaluations.js';
import { expectError } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';

describe('PATCH /api/v1/evaluations/:id (gestor e regras gerais)', () => {
  const ctx = useIntegrationContext();
  let h: Hierarchy;
  let api: EvaluationsApi;
  let open: SeededEvaluation;

  beforeEach(async () => {
    h = await insertHierarchy(ctx.pool);
    api = evaluationsApi(ctx.app);
    open = await insertEvaluation(ctx.pool, { userId: h.C1.id, managerId: h.G.id });
  });

  const rowOf = (id: number) => findEvaluationRowById(ctx.pool, id);
  const seed = (options: Partial<InsertEvaluationOptions>) =>
    insertEvaluation(ctx.pool, { userId: h.C2.id, managerId: h.G.id, ...options });

  it('[EVAL-30] gestor salva rascunho (com trim) e depois envia; com a self pendente segue ABERTA', async () => {
    const draft = await api.update(h.G, open.id, { managerScore: 3, managerFeedback: '  Bom ritmo; aprofunde testes.  ' });

    expect(draft.status).toBe(200);
    expect(draft.body.evaluation).toMatchObject({
      managerScore: 3,
      managerFeedback: 'Bom ritmo; aprofunde testes.',
      managerSubmittedAt: null,
      status: 'ABERTA',
    });

    const submitted = await api.update(h.G, open.id, { submit: true });

    expect(submitted.status).toBe(200);
    expect(submitted.body.evaluation).toMatchObject({ status: 'ABERTA', managerScore: 3 });
    expect(submitted.body.evaluation.managerSubmittedAt).toMatch(ISO_UTC_PATTERN);
    expect(await rowOf(open.id)).toMatchObject({ manager_score: 3, status: 'ABERTA' });
    expect((await rowOf(open.id))?.manager_submitted_at).toBeInstanceOf(Date);
  });

  it.each([
    ['sem nota e sem feedback', {}, { submit: true }, ['managerScore', 'managerFeedback']],
    ['só com a nota (Q-07: feedback obrigatório)', { managerScore: 3 }, { submit: true }, ['managerFeedback']],
    ['só com o feedback', { managerFeedback: 'Parecer.' }, { submit: true }, ['managerScore']],
    ['nota no payload, sem feedback', {}, { managerScore: 4, submit: true }, ['managerFeedback']],
  ] as const)('[EVAL-30] envio do gestor %s → 400 nos campos faltantes; nada muda', async (_d, draft, body, fields) => {
    const seeded = await seed(draft);
    const before = await rowOf(seeded.id);

    const res = await api.update(h.G, seeded.id, body);

    expectMissingForSubmit(res, fields);
    expect(await rowOf(seeded.id)).toEqual(before);
  });

  it('[EVAL-31] self já enviada; gestor envia a parte dele → CONCLUIDA, com tudo visível', async () => {
    const seeded = await seed({ selfScore: 4, selfComments: 'Semestre forte.', selfSubmitted: true });

    const res = await api.update(h.G, seeded.id, {
      managerScore: 3,
      managerFeedback: 'Concordo em parte.',
      submit: true,
    });

    expect(res.status).toBe(200);
    expect(res.body.evaluation).toMatchObject({
      status: 'CONCLUIDA',
      selfScore: 4,
      selfComments: 'Semestre forte.',
      managerScore: 3,
      managerFeedback: 'Concordo em parte.',
    });
    expect(await rowOf(seeded.id)).toMatchObject({ status: 'CONCLUIDA' });
  });

  it.each([
    ['selfScore', { selfScore: 3 }],
    ['selfComments', { selfComments: 'Texto do gestor.' }],
    ['payload misto (managerFeedback + selfComments)', { managerFeedback: 'Parecer.', selfComments: 'Texto.' }],
    ['parte self com submit', { selfScore: 3, submit: true }],
  ])('[EVAL-32] gestor envia campo do avaliado (%s) → 403 FORBIDDEN; NADA muda', async (_d, body) => {
    const before = await rowOf(open.id);

    const res = await api.update(h.G, open.id, body);

    expectError(res, 403, 'FORBIDDEN');
    expect(await rowOf(open.id)).toEqual(before);
  });

  it.each([
    ['gestor enviado: gestor edita o feedback', { managerSubmitted: true }, 'G', { managerFeedback: 'Outro parecer.' }],
    ['gestor enviado: gestor troca a nota', { managerSubmitted: true }, 'G', { managerScore: 5 }],
    ['gestor enviado: gestor envia de novo', { managerSubmitted: true }, 'G', { submit: true }],
    ['CONCLUIDA: avaliado edita', { selfSubmitted: true, managerSubmitted: true }, 'C2', { selfComments: 'Depois.' }],
    ['CONCLUIDA: avaliado envia de novo', { selfSubmitted: true, managerSubmitted: true }, 'C2', { submit: true }],
    ['CONCLUIDA: gestor edita', { selfSubmitted: true, managerSubmitted: true }, 'G', { managerFeedback: 'Depois.' }],
  ] as const)('[EVAL-33] %s → 409 EVALUATION_LOCKED; nada muda', async (_d, state, viewerKey, body) => {
    const seeded = await seed(state);
    const before = await rowOf(seeded.id);

    const res = await api.update(h[viewerKey], seeded.id, body);

    expect(res.status).toBe(409);
    expect(res.body).toEqual(LOCKED_BODY);
    expect(await rowOf(seeded.id)).toEqual(before);
  });

  it('[EVAL-34] GESTOR avaliado pelo gestor dele é EVALUATEE na própria avaliação', async () => {
    const GG = await insertManagerOf(ctx.pool, h.G);
    const own = await insertEvaluation(ctx.pool, { userId: h.G.id, managerId: GG.id });

    const selfPart = await api.update(h.G, own.id, { selfScore: 4 });

    expect(selfPart.status).toBe(200);
    expect(selfPart.body.evaluation).toMatchObject({ userId: h.G.id, managerId: GG.id, selfScore: 4 });

    const before = await rowOf(own.id);
    const managerPart = await api.update(h.G, own.id, { managerScore: 5 });

    expectError(managerPart, 403, 'FORBIDDEN');
    expect(await rowOf(own.id)).toEqual(before);
  });

  it.each([
    ['colaborador de outro time', 'X', { selfScore: 1 }],
    ['par da mesma equipe', 'C2', { selfScore: 1 }],
    ['gestor de outro time enviando a parte do gestor', 'G2', { managerScore: 1 }],
  ] as const)('[EVAL-35] PATCH por %s → 404 "Avaliação não encontrada."; nada muda', async (_d, viewerKey, body) => {
    const before = await rowOf(open.id);

    const res = await api.update(h[viewerKey], open.id, body);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(EVALUATION_NOT_FOUND_BODY);
    expect(await rowOf(open.id)).toEqual(before);
  });

  it('[EVAL-35] PATCH em avaliação inexistente → 404 com o mesmo corpo', async () => {
    const res = await api.update(h.G, NONEXISTENT_ID, { managerScore: 3 });

    expect(res.status).toBe(404);
    expect(res.body).toEqual(EVALUATION_NOT_FOUND_BODY);
  });

  it.each([
    ['corpo vazio', {}, 'body'],
    ['nota inválida', { selfScore: 6 }, 'selfScore'],
  ])('[EVAL-36] usuário FORA do escopo com %s → 400 (validação antes do escopo)', async (_d, body, field) => {
    const res = await api.update(h.X, open.id, body);

    expectValidationErrorOn(res, field);
  });

  it.each(INVALID_UPDATE_BODIES)('[EVAL-37] %s → 400 VALIDATION_ERROR; nada muda', async (_d, body, field) => {
    const before = await rowOf(open.id);

    const res = await api.update(h.C1, open.id, body);

    expectValidationErrorOn(res, field);
    expect(await rowOf(open.id)).toEqual(before);
  });

  it.each(FORBIDDEN_UPDATE_FIELDS)('[EVAL-37] campo proibido "%s" → 400; nada muda', async (field, body) => {
    const before = await rowOf(open.id);

    const res = await api.update(h.C1, open.id, body);

    expectValidationErrorOn(res, field);
    expect(await rowOf(open.id)).toEqual(before);
  });

  it.each([
    ['corpo válido', { selfScore: 4 }],
    ['corpo inválido (401 vem antes do 400)', {}],
  ])('[EVAL-38] sem sessão → 401 UNAUTHENTICATED (%s); nada muda', async (_d, body) => {
    const before = await rowOf(open.id);

    const res = await api.update(null, open.id, body);

    expectError(res, 401, 'UNAUTHENTICATED');
    expect(await rowOf(open.id)).toEqual(before);
  });
});
