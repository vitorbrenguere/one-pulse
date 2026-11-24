import { beforeEach, describe, expect, it } from 'vitest';
import { INVALID_EVALUATION_IDS } from '../../fixtures/evaluations.fixtures.js';
import { insertHierarchy, type Hierarchy, type SeededUser } from '../../helpers/db.js';
import {
  EVALUATION_NOT_FOUND_BODY,
  evaluationsApi,
  expectValidationErrorOn,
  insertEvaluation,
  insertManagerOf,
  NONEXISTENT_ID,
  type EvaluationsApi,
  type SeededEvaluation,
} from '../../helpers/evaluations.js';
import { expectError } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';

describe('GET /api/v1/evaluations/:id', () => {
  const ctx = useIntegrationContext();
  let h: Hierarchy;
  let GG: SeededUser;
  let api: EvaluationsApi;
  let e: Record<'C1' | 'G' | 'X' | 'Ci', SeededEvaluation>;

  beforeEach(async () => {
    h = await insertHierarchy(ctx.pool);
    GG = await insertManagerOf(ctx.pool, h.G);
    api = evaluationsApi(ctx.app);
    e = {
      // CONCLUIDA: o DTO é o mesmo para o avaliado e para o gestor (a ocultação tem testes próprios).
      C1: await insertEvaluation(ctx.pool, {
        userId: h.C1.id,
        managerId: h.G.id,
        selfScore: 4,
        selfComments: 'Entreguei a API de usuários.',
        selfSubmitted: true,
        managerScore: 3,
        managerFeedback: 'Bom ritmo; aprofunde testes.',
        managerSubmitted: true,
      }),
      G: await insertEvaluation(ctx.pool, { userId: h.G.id, managerId: GG.id }),
      X: await insertEvaluation(ctx.pool, { userId: h.X.id, managerId: h.G2.id }),
      Ci: await insertEvaluation(ctx.pool, { userId: h.Ci.id, managerId: h.G.id }),
    };
  });

  it.each([
    ['COLABORADOR consulta a própria', 'C1', 'C1'],
    ['GESTOR consulta a de liderado direto', 'G', 'C1'],
    ['GESTOR consulta a própria (aberta pelo gestor dele)', 'G', 'G'],
  ] as const)('[EVAL-17] %s → 200 com o EvaluationDTO completo', async (_d, viewerKey, evaluationKey) => {
    const res = await api.get(h[viewerKey], e[evaluationKey].id);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['evaluation']);
    expect(res.body.evaluation).toEqual(e[evaluationKey]);
  });

  it('[EVAL-17] o gestor do gestor (GG) consulta a avaliação que abriu para G → 200', async () => {
    const res = await api.get(GG, e.G.id);

    expect(res.status).toBe(200);
    expect(res.body.evaluation).toEqual(e.G);
  });

  it.each([
    ['COLABORADOR → avaliação de par da mesma equipe', () => h.C2, 'C1'],
    ['colaborador de outro time → avaliação de C1', () => h.X, 'C1'],
    ['outro GESTOR → avaliação de liderado alheio', () => h.G2, 'C1'],
    ['GESTOR → avaliação de liderado inativo', () => h.G, 'Ci'],
    ['GESTOR → avaliação de outro time', () => h.G, 'X'],
    ['COLABORADOR → avaliação do próprio gestor', () => h.C1, 'G'],
    ['gestor do gestor → avaliação de liderado indireto', () => GG, 'C1'],
    ['GESTOR → avaliação inexistente', () => h.G, null],
  ] as const)('[EVAL-18] %s → 404 "Avaliação não encontrada." (corpo idêntico)', async (_d, viewer, evaluationKey) => {
    const id = evaluationKey ? e[evaluationKey].id : NONEXISTENT_ID;

    const res = await api.get(viewer(), id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(EVALUATION_NOT_FOUND_BODY);
  });

  it.each(INVALID_EVALUATION_IDS)('[EVAL-19] :id inválido "%s" → 400 no campo id', async (rawId) => {
    const res = await api.get(h.C1, rawId);

    expectValidationErrorOn(res, 'id');
  });

  it.each([
    ['id válido', () => String(e.C1.id)],
    ['id inválido (401 vem antes do 400)', () => 'abc'],
  ])('[EVAL-20] sem sessão → 401 UNAUTHENTICATED (%s)', async (_d, rawId) => {
    const res = await api.get(null, rawId());

    expectError(res, 401, 'UNAUTHENTICATED');
  });
});
