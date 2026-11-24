import { beforeEach, describe, expect, it } from 'vitest';
import { insertHierarchy, type Hierarchy } from '../../helpers/db.js';
import {
  evaluationsApi,
  insertEvaluation,
  ISO_UTC_PATTERN,
  withManagerPartHidden,
  withSelfPartHidden,
  type EvaluationsApi,
} from '../../helpers/evaluations.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';

/**
 * Spec 04 §2.5: a ocultação acontece NO BACK-END. Se dependesse da tela, o valor
 * apareceria na resposta da API (aba Network do navegador).
 */
describe('Visibilidade anti-viés das avaliações', () => {
  const ctx = useIntegrationContext();
  let h: Hierarchy;
  let api: EvaluationsApi;

  beforeEach(async () => {
    h = await insertHierarchy(ctx.pool);
    api = evaluationsApi(ctx.app);
  });

  /** Gestor já enviou; a autoavaliação está em rascunho (com nota, pronta para enviar). */
  const managerSubmittedSelfDraft = () =>
    insertEvaluation(ctx.pool, {
      userId: h.C1.id,
      managerId: h.G.id,
      selfScore: 4,
      selfComments: 'Meu rascunho.',
      managerScore: 2,
      managerFeedback: 'Precisa melhorar a comunicação.',
      managerSubmitted: true,
    });

  it('[EVAL-21] avaliado NÃO vê nota e feedback do gestor enquanto ABERTA, mas sabe que o gestor enviou', async () => {
    const seeded = await managerSubmittedSelfDraft();

    const res = await api.get(h.C1, seeded.id);

    expect(res.status).toBe(200);
    expect(res.body.evaluation).toEqual(withManagerPartHidden(seeded));
    expect(res.body.evaluation.managerSubmittedAt).toBe(seeded.managerSubmittedAt);
    expect(res.body.evaluation).toMatchObject({ selfScore: 4, selfComments: 'Meu rascunho.' });
  });

  it('[EVAL-22] o envio que conclui a avaliação já REVELA a parte do gestor na resposta e nos GETs seguintes', async () => {
    const seeded = await managerSubmittedSelfDraft();

    const submitted = await api.update(h.C1, seeded.id, { submit: true });

    expect(submitted.status).toBe(200);
    expect(submitted.body.evaluation).toMatchObject({
      status: 'CONCLUIDA',
      selfScore: 4,
      managerScore: 2,
      managerFeedback: 'Precisa melhorar a comunicação.',
    });
    expect(submitted.body.evaluation.selfSubmittedAt).toMatch(ISO_UTC_PATTERN);

    const after = await api.get(h.C1, seeded.id);

    expect(after.body.evaluation).toEqual(submitted.body.evaluation);
  });

  it('[EVAL-23] gestor NUNCA vê o rascunho da autoavaliação; vê assim que ela é enviada', async () => {
    const seeded = await insertEvaluation(ctx.pool, {
      userId: h.C1.id,
      managerId: h.G.id,
      selfScore: 5,
      selfComments: 'Rascunho privado.',
    });

    const whileDraft = await api.get(h.G, seeded.id);

    expect(whileDraft.status).toBe(200);
    expect(whileDraft.body.evaluation).toEqual(withSelfPartHidden(seeded));

    const submitted = await api.update(h.C1, seeded.id, { submit: true });
    expect(submitted.status).toBe(200);

    const afterSubmit = await api.get(h.G, seeded.id);

    expect(afterSubmit.body.evaluation).toMatchObject({
      status: 'ABERTA',
      selfScore: 5,
      selfComments: 'Rascunho privado.',
    });
    expect(afterSubmit.body.evaluation.selfSubmittedAt).toMatch(ISO_UTC_PATTERN);
  });

  it('[EVAL-23] o próprio PATCH do gestor também devolve a self oculta enquanto ela é rascunho', async () => {
    const seeded = await insertEvaluation(ctx.pool, { userId: h.C1.id, managerId: h.G.id, selfScore: 5 });

    const res = await api.update(h.G, seeded.id, { managerScore: 3 });

    expect(res.status).toBe(200);
    expect(res.body.evaluation).toMatchObject({ selfScore: null, selfComments: null, managerScore: 3 });
  });
});
