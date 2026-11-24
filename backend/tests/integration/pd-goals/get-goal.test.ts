import { beforeEach, describe, expect, it } from 'vitest';
import { INVALID_GOAL_IDS } from '../../fixtures/pd-goals.fixtures.js';
import { insertHierarchy, type Hierarchy } from '../../helpers/db.js';
import {
  expectValidationErrorOn,
  GOAL_NOT_FOUND_BODY,
  goalsApi,
  insertGoal,
  NONEXISTENT_ID,
  seededGoalDTO,
  type GoalsApi,
  type SeededGoal,
} from '../../helpers/goals.js';
import { expectError } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';

describe('GET /api/v1/pd-goals/:id', () => {
  const ctx = useIntegrationContext();
  let h: Hierarchy;
  let api: GoalsApi;
  let goals: Record<'C1' | 'G' | 'X' | 'Ci', SeededGoal>;

  beforeEach(async () => {
    h = await insertHierarchy(ctx.pool);
    api = goalsApi(ctx.app);
    goals = {
      C1: await insertGoal(ctx.pool, {
        userId: h.C1.id,
        createdBy: h.G.id,
        title: 'Aprender testes de integração',
        description: 'Cobrir a API com Supertest.',
        category: 'TECNICA',
        status: 'EM_ANDAMENTO',
        progress: 40,
        targetDate: '2099-03-31',
        managerFeedback: 'Ótimo avanço.',
      }),
      G: await insertGoal(ctx.pool, { userId: h.G.id, title: 'Meta da gestora', category: 'CARREIRA' }),
      X: await insertGoal(ctx.pool, { userId: h.X.id, title: 'Meta de outro time' }),
      Ci: await insertGoal(ctx.pool, { userId: h.Ci.id, title: 'Meta do inativo' }),
    };
  });

  it.each(['C1', 'G'] as const)('[GOAL-16] %s consulta a própria meta → 200 com o GoalDTO completo', async (who) => {
    const res = await api.get(h[who], goals[who].id);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['goal']);
    expect(res.body.goal).toEqual(seededGoalDTO(goals[who]));
  });

  it('[GOAL-17] GESTOR consulta meta de liderado direto → 200, incluindo o parecer', async () => {
    const res = await api.get(h.G, goals.C1.id);

    expect(res.status).toBe(200);
    expect(res.body.goal).toEqual(seededGoalDTO(goals.C1));
    expect(res.body.goal.managerFeedback).toBe('Ótimo avanço.');
  });

  it.each([
    ['GESTOR → meta de colaborador de outro time', 'G', 'X'],
    ['GESTOR → meta de liderado inativo', 'G', 'Ci'],
    ['COLABORADOR → meta de par da mesma equipe', 'C2', 'C1'],
    ['COLABORADOR → meta do próprio gestor', 'C1', 'G'],
    ['outro GESTOR → meta de liderado alheio', 'G2', 'C1'],
    ['GESTOR → meta inexistente', 'G', null],
  ] as const)('[GOAL-18] %s → 404 "Meta não encontrada." (corpo idêntico)', async (_description, viewerKey, goalKey) => {
    const goalId = goalKey ? goals[goalKey].id : NONEXISTENT_ID;

    const res = await api.get(h[viewerKey], goalId);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(GOAL_NOT_FOUND_BODY);
  });

  it.each(INVALID_GOAL_IDS)('[GOAL-19] :id inválido "%s" → 400 no campo id', async (rawId) => {
    const res = await api.get(h.C1, rawId);

    expectValidationErrorOn(res, 'id');
  });

  it.each([
    ['id válido', () => String(goals.C1.id)],
    ['id inválido (401 vem antes do 400)', () => 'abc'],
  ])('[GOAL-20] sem sessão → 401 UNAUTHENTICATED (%s)', async (_description, rawId) => {
    const res = await api.get(null, rawId());

    expectError(res, 401, 'UNAUTHENTICATED');
  });
});
