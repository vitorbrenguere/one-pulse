import { beforeEach, describe, expect, it } from 'vitest';
import { INVALID_LIST_QUERIES } from '../../fixtures/pd-goals.fixtures.js';
import { insertHierarchy, type Hierarchy } from '../../helpers/db.js';
import {
  expectValidationErrorOn,
  goalsApi,
  insertGoal,
  NONEXISTENT_ID,
  seededGoalDTO,
  USER_NOT_FOUND_BODY,
  type GoalsApi,
  type SeededGoal,
} from '../../helpers/goals.js';
import { expectError } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';

describe('GET /api/v1/pd-goals', () => {
  const ctx = useIntegrationContext();
  let h: Hierarchy;
  let api: GoalsApi;
  /** Metas de C1, na ORDEM ESPERADA da listagem (target_date ASC, id ASC). */
  let c1Goals: SeededGoal[];
  let gGoal: SeededGoal;

  beforeEach(async () => {
    h = await insertHierarchy(ctx.pool);
    api = goalsApi(ctx.app);

    // Inseridas fora de ordem de propósito: o id menor tem o prazo mais distante,
    // e duas metas dividem o mesmo prazo (o desempate é por id).
    const late = await insertGoal(ctx.pool, { userId: h.C1.id, title: 'Prazo distante', targetDate: '2099-12-31' });
    const sameDateFirst = await insertGoal(ctx.pool, {
      userId: h.C1.id,
      createdBy: h.G.id,
      title: 'Criada pelo gestor',
      targetDate: '2098-01-01',
      category: 'CARREIRA',
    });
    const sameDateSecond = await insertGoal(ctx.pool, {
      userId: h.C1.id,
      title: 'Mesmo prazo, id maior',
      targetDate: '2098-01-01',
      status: 'EM_ANDAMENTO',
    });
    c1Goals = [sameDateFirst, sameDateSecond, late];

    await insertGoal(ctx.pool, { userId: h.C2.id, title: 'Meta da C2' });
    gGoal = await insertGoal(ctx.pool, { userId: h.G.id, title: 'Meta da gestora' });
    await insertGoal(ctx.pool, { userId: h.X.id, title: 'Meta de outro time' });
    await insertGoal(ctx.pool, { userId: h.Ci.id, title: 'Meta do inativo' });
  });

  it('[GOAL-09] COLABORADOR lista só as próprias metas, ordenadas por targetDate ASC, id ASC', async () => {
    const res = await api.list(h.C1);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['goals']);
    expect(res.body.goals).toEqual(c1Goals.map(seededGoalDTO));
  });

  it('[GOAL-10] GESTOR sem userId lista só as PRÓPRIAS metas (não as da equipe)', async () => {
    const res = await api.list(h.G);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ goals: [seededGoalDTO(gGoal)] });
  });

  it('[GOAL-11] GESTOR com ?userId=<liderado> lista as metas dele (criadas por ele e pelo gestor)', async () => {
    const res = await api.list(h.G, `?userId=${h.C1.id}`);

    expect(res.status).toBe(200);
    expect(res.body.goals).toEqual(c1Goals.map(seededGoalDTO));
    expect(new Set(res.body.goals.map((goal: { createdBy: number }) => goal.createdBy))).toEqual(
      new Set([h.C1.id, h.G.id]),
    );
  });

  it.each([
    ['GESTOR → colaborador de outro time', 'G', 'X'],
    ['GESTOR → liderado inativo', 'G', 'Ci'],
    ['GESTOR → usuário inexistente', 'G', null],
    ['COLABORADOR → par da mesma equipe', 'C1', 'C2'],
    ['COLABORADOR → o próprio gestor', 'C1', 'G'],
  ] as const)('[GOAL-12] %s → 404 "Usuário não encontrado." (corpo idêntico)', async (_description, viewerKey, targetKey) => {
    const targetId = targetKey ? h[targetKey].id : NONEXISTENT_ID;

    const res = await api.list(h[viewerKey], `?userId=${targetId}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(USER_NOT_FOUND_BODY);
  });

  it('[GOAL-13] ?userId=<o próprio viewer> equivale à listagem própria', async () => {
    const withQuery = await api.list(h.C1, `?userId=${h.C1.id}`);
    const withoutQuery = await api.list(h.C1);

    expect(withQuery.status).toBe(200);
    expect(withQuery.body).toEqual(withoutQuery.body);
    expect(withQuery.body.goals).toHaveLength(3);
  });

  it('[GOAL-13] usuário sem metas → 200 { goals: [] }', async () => {
    const res = await api.list(h.G2);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ goals: [] });
  });

  it.each(INVALID_LIST_QUERIES)('[GOAL-14] %s → 400 VALIDATION_ERROR', async (_description, query, _object, field) => {
    const res = await api.list(h.G, query);

    expectValidationErrorOn(res, field);
  });

  it.each([
    ['sem query', ''],
    ['query inválida (401 vem antes do 400)', '?userId=abc'],
  ])('[GOAL-15] sem sessão → 401 UNAUTHENTICATED (%s)', async (_description, query) => {
    const res = await api.list(null, query);

    expectError(res, 401, 'UNAUTHENTICATED');
  });
});
