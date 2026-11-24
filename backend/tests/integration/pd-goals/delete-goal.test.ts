import { beforeEach, describe, expect, it } from 'vitest';
import { INVALID_GOAL_IDS } from '../../fixtures/pd-goals.fixtures.js';
import { insertHierarchy, type Hierarchy } from '../../helpers/db.js';
import {
  expectValidationErrorOn,
  findGoalRowById,
  GOAL_NOT_DELETABLE_MESSAGE,
  GOAL_NOT_FOUND_BODY,
  goalsApi,
  insertGoal,
  NONEXISTENT_ID,
  type GoalsApi,
  type SeededGoal,
} from '../../helpers/goals.js';
import { expectError } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';

describe('DELETE /api/v1/pd-goals/:id', () => {
  const ctx = useIntegrationContext();
  let h: Hierarchy;
  let api: GoalsApi;
  let c1Goal: SeededGoal;

  beforeEach(async () => {
    h = await insertHierarchy(ctx.pool);
    api = goalsApi(ctx.app);
    c1Goal = await insertGoal(ctx.pool, { userId: h.C1.id });
  });

  it.each([
    ['criada por ele mesmo', () => h.C1.id],
    ['criada pelo gestor (Q-03: o dono exclui)', () => h.G.id],
  ])('[GOAL-40] dono exclui a própria meta NAO_INICIADA %s → 204 sem corpo, e a meta some', async (_d, createdBy) => {
    const goal = await insertGoal(ctx.pool, { userId: h.C1.id, createdBy: createdBy() });

    const res = await api.remove(h.C1, goal.id);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(await findGoalRowById(ctx.pool, goal.id)).toBeUndefined();

    const after = await api.get(h.C1, goal.id);
    expect(after.status).toBe(404);
    expect(after.body).toEqual(GOAL_NOT_FOUND_BODY);
  });

  it.each(['EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA'] as const)(
    '[GOAL-41] dono exclui meta %s → 409 GOAL_NOT_DELETABLE orientando o cancelamento; a meta permanece',
    async (status) => {
      const goal = await insertGoal(ctx.pool, { userId: h.C1.id, status });
      const before = await findGoalRowById(ctx.pool, goal.id);

      const res = await api.remove(h.C1, goal.id);

      expect(res.status).toBe(409);
      expect(res.body).toEqual({ error: { code: 'GOAL_NOT_DELETABLE', message: GOAL_NOT_DELETABLE_MESSAGE } });
      expect(await findGoalRowById(ctx.pool, goal.id)).toEqual(before);
    },
  );

  it('[GOAL-42] gestor tenta excluir meta NAO_INICIADA do liderado que ELE criou → 403; a meta permanece', async () => {
    const goal = await insertGoal(ctx.pool, { userId: h.C1.id, createdBy: h.G.id });

    const res = await api.remove(h.G, goal.id);

    expectError(res, 403, 'FORBIDDEN');
    expect(await findGoalRowById(ctx.pool, goal.id)).toBeDefined();
  });

  it.each([
    ['colaborador de outro time', 'X'],
    ['par da mesma equipe', 'C2'],
    ['gestor de outro time', 'G2'],
  ] as const)('[GOAL-43] DELETE por %s → 404 "Meta não encontrada."; a meta permanece', async (_d, viewerKey) => {
    const res = await api.remove(h[viewerKey], c1Goal.id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(GOAL_NOT_FOUND_BODY);
    expect(await findGoalRowById(ctx.pool, c1Goal.id)).toBeDefined();
  });

  it('[GOAL-43] DELETE de meta inexistente → 404 com o mesmo corpo', async () => {
    const res = await api.remove(h.C1, NONEXISTENT_ID);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(GOAL_NOT_FOUND_BODY);
  });

  it.each(INVALID_GOAL_IDS)('[GOAL-44] :id inválido "%s" → 400 no campo id', async (rawId) => {
    const res = await api.remove(h.C1, rawId);

    expectValidationErrorOn(res, 'id');
  });

  it.each([
    ['id válido', () => String(c1Goal.id)],
    ['id inválido (401 vem antes do 400)', () => 'abc'],
  ])('[GOAL-44] sem sessão → 401 UNAUTHENTICATED (%s); a meta permanece', async (_d, rawId) => {
    const res = await api.remove(null, rawId());

    expectError(res, 401, 'UNAUTHENTICATED');
    expect(await findGoalRowById(ctx.pool, c1Goal.id)).toBeDefined();
  });
});
