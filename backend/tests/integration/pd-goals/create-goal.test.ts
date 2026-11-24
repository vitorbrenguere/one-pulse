import { beforeEach, describe, expect, it } from 'vitest';
import {
  FAR_FUTURE,
  FORBIDDEN_CREATE_FIELDS,
  INVALID_CREATE_BODIES,
  VALID_CREATE_BODY,
} from '../../fixtures/pd-goals.fixtures.js';
import { insertHierarchy, type Hierarchy } from '../../helpers/db.js';
import {
  addDaysUtc,
  countGoals,
  expectGoalDTO,
  expectValidationErrorOn,
  findGoalRowById,
  goalsApi,
  NONEXISTENT_ID,
  PAST_TARGET_DATE_MESSAGE,
  todayUtc,
  USER_NOT_FOUND_BODY,
  type GoalsApi,
} from '../../helpers/goals.js';
import { expectError } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';

describe('POST /api/v1/pd-goals', () => {
  const ctx = useIntegrationContext();
  let h: Hierarchy;
  let api: GoalsApi;

  beforeEach(async () => {
    h = await insertHierarchy(ctx.pool);
    api = goalsApi(ctx.app);
  });

  it('[GOAL-01] COLABORADOR cria meta para si → 201 com status inicial e persistida no banco', async () => {
    const res = await api.create(h.C1, VALID_CREATE_BODY);

    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(['goal']);
    expectGoalDTO(res.body.goal, {
      userId: h.C1.id,
      createdBy: h.C1.id,
      title: VALID_CREATE_BODY.title,
      category: 'TECNICA',
      targetDate: FAR_FUTURE,
      status: 'NAO_INICIADA',
      progress: 0,
    });

    const row = await findGoalRowById(ctx.pool, res.body.goal.id);
    expect(row).toMatchObject({
      user_id: h.C1.id,
      created_by: h.C1.id,
      title: VALID_CREATE_BODY.title,
      description: null,
      category: 'TECNICA',
      status: 'NAO_INICIADA',
      progress: 0,
      target_date: FAR_FUTURE,
      completed_at: null,
      manager_feedback: null,
      manager_feedback_at: null,
    });
    expect(await countGoals(ctx.pool)).toBe(1);
  });

  it('[GOAL-01] persiste description e title normalizados (trim)', async () => {
    const res = await api.create(h.C1, {
      title: '  Conduzir uma retrospectiva  ',
      description: '  Facilitar a retro da sprint.  ',
      category: 'COMPORTAMENTAL',
      targetDate: FAR_FUTURE,
    });

    expect(res.status).toBe(201);
    expect(res.body.goal).toMatchObject({
      title: 'Conduzir uma retrospectiva',
      description: 'Facilitar a retro da sprint.',
      category: 'COMPORTAMENTAL',
    });
    expect(await findGoalRowById(ctx.pool, res.body.goal.id)).toMatchObject({
      title: 'Conduzir uma retrospectiva',
      description: 'Facilitar a retro da sprint.',
    });
  });

  it('[GOAL-02] GESTOR cria meta para liderado direto → dono é o liderado, createdBy é o gestor', async () => {
    const res = await api.create(h.G, { ...VALID_CREATE_BODY, userId: h.C1.id });

    expect(res.status).toBe(201);
    expectGoalDTO(res.body.goal, {
      userId: h.C1.id,
      createdBy: h.G.id,
      title: VALID_CREATE_BODY.title,
      targetDate: FAR_FUTURE,
    });
    expect(await findGoalRowById(ctx.pool, res.body.goal.id)).toMatchObject({ user_id: h.C1.id, created_by: h.G.id });
  });

  it('[GOAL-03] userId igual ao próprio viewer equivale a omiti-lo', async () => {
    const res = await api.create(h.C1, { ...VALID_CREATE_BODY, userId: h.C1.id });

    expect(res.status).toBe(201);
    expectGoalDTO(res.body.goal, {
      userId: h.C1.id,
      createdBy: h.C1.id,
      title: VALID_CREATE_BODY.title,
      targetDate: FAR_FUTURE,
    });
  });

  it.each([
    ['GESTOR → colaborador de outro time', 'G', 'X'],
    ['GESTOR → liderado inativo', 'G', 'Ci'],
    ['GESTOR → usuário inexistente', 'G', null],
    ['COLABORADOR → par da mesma equipe', 'C1', 'C2'],
    ['COLABORADOR → o próprio gestor', 'C1', 'G'],
  ] as const)('[GOAL-04] %s → 404 "Usuário não encontrado." sem criar meta', async (_description, viewerKey, targetKey) => {
    const targetId = targetKey ? h[targetKey].id : NONEXISTENT_ID;

    const res = await api.create(h[viewerKey], { ...VALID_CREATE_BODY, userId: targetId });

    expect(res.status).toBe(404);
    expect(res.body).toEqual(USER_NOT_FOUND_BODY);
    expect(await countGoals(ctx.pool)).toBe(0);
  });

  it.each(INVALID_CREATE_BODIES)('[GOAL-05] %s → 400 VALIDATION_ERROR sem criar meta', async (_description, body, field) => {
    const res = await api.create(h.C1, body);

    expectValidationErrorOn(res, field);
    expect(await countGoals(ctx.pool)).toBe(0);
  });

  it('[GOAL-06] targetDate ONTEM (UTC) → 400 no campo targetDate', async () => {
    const res = await api.create(h.C1, { ...VALID_CREATE_BODY, targetDate: addDaysUtc(todayUtc(), -1) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ field: 'targetDate', message: PAST_TARGET_DATE_MESSAGE }],
    });
    expect(await countGoals(ctx.pool)).toBe(0);
  });

  it('[GOAL-06] targetDate HOJE (UTC) → 201', async () => {
    const today = todayUtc();

    const res = await api.create(h.C1, { ...VALID_CREATE_BODY, targetDate: today });

    expect(res.status).toBe(201);
    expect(res.body.goal.targetDate).toBe(today);
  });

  it.each(FORBIDDEN_CREATE_FIELDS)('[GOAL-07] campo proibido "%s" → 400 sem criar meta', async (field, body) => {
    const res = await api.create(h.C1, body);

    expectValidationErrorOn(res, field);
    expect(await countGoals(ctx.pool)).toBe(0);
  });

  it.each([
    ['corpo válido', VALID_CREATE_BODY],
    ['corpo inválido (401 vem antes do 400)', {}],
  ])('[GOAL-08] sem sessão → 401 UNAUTHENTICATED (%s)', async (_description, body) => {
    const res = await api.create(null, body);

    expectError(res, 401, 'UNAUTHENTICATED');
    expect(await countGoals(ctx.pool)).toBe(0);
  });
});
