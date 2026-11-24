import { beforeEach, describe, expect, it } from 'vitest';
import { insertHierarchy, type Hierarchy } from '../../helpers/db.js';
import {
  addDaysUtc,
  findGoalRowById,
  GOAL_LOCKED_MESSAGE,
  goalsApi,
  insertGoal,
  ISO_UTC_PATTERN,
  PAST_TARGET_DATE_MESSAGE,
  SEEDED_TIMESTAMP_ISO,
  todayUtc,
  type GoalsApi,
} from '../../helpers/goals.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';

describe('PATCH /api/v1/pd-goals/:id (dono: conteúdo, status e progresso)', () => {
  const ctx = useIntegrationContext();
  let h: Hierarchy;
  let api: GoalsApi;

  beforeEach(async () => {
    h = await insertHierarchy(ctx.pool);
    api = goalsApi(ctx.app);
  });

  it('[GOAL-21] dono edita title, description, category e targetDate → 200, persistido e updatedAt avança', async () => {
    const goal = await insertGoal(ctx.pool, { userId: h.C1.id, title: 'Título antigo', description: 'Antiga' });

    const res = await api.update(h.C1, goal.id, {
      title: '  Novo título  ',
      description: '  Nova descrição  ',
      category: 'CARREIRA',
      targetDate: '2099-06-30',
    });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['goal']);
    expect(res.body.goal).toMatchObject({
      id: goal.id,
      userId: h.C1.id,
      title: 'Novo título',
      description: 'Nova descrição',
      category: 'CARREIRA',
      targetDate: '2099-06-30',
      status: 'NAO_INICIADA',
      progress: 0,
      createdAt: SEEDED_TIMESTAMP_ISO,
    });
    expect(res.body.goal.updatedAt).toMatch(ISO_UTC_PATTERN);
    expect(Date.parse(res.body.goal.updatedAt)).toBeGreaterThan(Date.parse(SEEDED_TIMESTAMP_ISO));

    expect(await findGoalRowById(ctx.pool, goal.id)).toMatchObject({
      title: 'Novo título',
      description: 'Nova descrição',
      category: 'CARREIRA',
      target_date: '2099-06-30',
    });
  });

  it('[GOAL-21] description: null remove a descrição e preserva os demais campos', async () => {
    const goal = await insertGoal(ctx.pool, {
      userId: h.C1.id,
      title: 'Manter este título',
      description: 'Será removida',
      category: 'COMPORTAMENTAL',
      targetDate: '2099-01-15',
    });

    const res = await api.update(h.C1, goal.id, { description: null });

    expect(res.status).toBe(200);
    expect(res.body.goal).toMatchObject({
      description: null,
      title: 'Manter este título',
      category: 'COMPORTAMENTAL',
      targetDate: '2099-01-15',
    });
    expect(await findGoalRowById(ctx.pool, goal.id)).toMatchObject({ description: null, title: 'Manter este título' });
  });

  it('[GOAL-22] fluxo ponta a ponta: progress 30 inicia a meta e progress 100 a conclui', async () => {
    const goal = await insertGoal(ctx.pool, { userId: h.C1.id });

    const started = await api.update(h.C1, goal.id, { progress: 30 });

    expect(started.status).toBe(200);
    expect(started.body.goal).toMatchObject({ status: 'EM_ANDAMENTO', progress: 30, completedAt: null });

    const before = Date.now();
    const finished = await api.update(h.C1, goal.id, { progress: 100 });

    expect(finished.status).toBe(200);
    expect(finished.body.goal).toMatchObject({ status: 'CONCLUIDA', progress: 100 });
    expect(finished.body.goal.completedAt).toMatch(ISO_UTC_PATTERN);
    // DATETIME trunca os milissegundos: tolerância de 1s para trás.
    expect(Date.parse(finished.body.goal.completedAt)).toBeGreaterThanOrEqual(before - 1000);

    const row = await findGoalRowById(ctx.pool, goal.id);
    expect(row).toMatchObject({ status: 'CONCLUIDA', progress: 100 });
    expect(row?.completed_at).toBeInstanceOf(Date);
  });

  it('[GOAL-22] NAO_INICIADA → CONCLUIDA direto aplica progress 100 e completedAt (Q-05)', async () => {
    const goal = await insertGoal(ctx.pool, { userId: h.C1.id });

    const res = await api.update(h.C1, goal.id, { status: 'CONCLUIDA' });

    expect(res.status).toBe(200);
    expect(res.body.goal).toMatchObject({ status: 'CONCLUIDA', progress: 100 });
    expect(res.body.goal.completedAt).toMatch(ISO_UTC_PATTERN);
  });

  it('[GOAL-22] cancelar congela o progresso e mantém completedAt null', async () => {
    const goal = await insertGoal(ctx.pool, { userId: h.C1.id, status: 'EM_ANDAMENTO', progress: 55 });

    const res = await api.update(h.C1, goal.id, { status: 'CANCELADA' });

    expect(res.status).toBe(200);
    expect(res.body.goal).toMatchObject({ status: 'CANCELADA', progress: 55, completedAt: null });
    expect(await findGoalRowById(ctx.pool, goal.id)).toMatchObject({ status: 'CANCELADA', progress: 55, completed_at: null });
  });

  it('[GOAL-23] EM_ANDAMENTO → NAO_INICIADA → 409 INVALID_STATUS_TRANSITION, nada muda', async () => {
    const goal = await insertGoal(ctx.pool, { userId: h.C1.id, status: 'EM_ANDAMENTO', progress: 40 });
    const before = await findGoalRowById(ctx.pool, goal.id);

    const res = await api.update(h.C1, goal.id, { status: 'NAO_INICIADA' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: {
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Transição de status inválida: de EM_ANDAMENTO para NAO_INICIADA.',
      },
    });
    expect(await findGoalRowById(ctx.pool, goal.id)).toEqual(before);
  });

  it.each([
    ['CONCLUIDA', { title: 'Novo título' }],
    ['CONCLUIDA', { progress: 50 }],
    ['CONCLUIDA', { status: 'EM_ANDAMENTO' }],
    ['CONCLUIDA', { status: 'CONCLUIDA' }],
    ['CANCELADA', { title: 'Novo título' }],
    ['CANCELADA', { progress: 50 }],
    ['CANCELADA', { status: 'EM_ANDAMENTO' }],
    ['CANCELADA', { targetDate: '2099-06-30' }],
  ] as const)('[GOAL-24] meta %s + %o do dono → 409 GOAL_LOCKED, nada muda', async (status, body) => {
    const goal = await insertGoal(ctx.pool, { userId: h.C1.id, status });
    const before = await findGoalRowById(ctx.pool, goal.id);

    const res = await api.update(h.C1, goal.id, body);

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: 'GOAL_LOCKED', message: GOAL_LOCKED_MESSAGE } });
    expect(await findGoalRowById(ctx.pool, goal.id)).toEqual(before);
  });

  it('[GOAL-25] targetDate ONTEM (UTC) no PATCH → 400 no campo targetDate, nada muda', async () => {
    const goal = await insertGoal(ctx.pool, { userId: h.C1.id });
    const before = await findGoalRowById(ctx.pool, goal.id);

    const res = await api.update(h.C1, goal.id, { targetDate: addDaysUtc(todayUtc(), -1) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ field: 'targetDate', message: PAST_TARGET_DATE_MESSAGE }],
    });
    expect(await findGoalRowById(ctx.pool, goal.id)).toEqual(before);
  });

  it('[GOAL-25] targetDate HOJE (UTC) no PATCH → 200', async () => {
    const goal = await insertGoal(ctx.pool, { userId: h.C1.id });
    const today = todayUtc();

    const res = await api.update(h.C1, goal.id, { targetDate: today });

    expect(res.status).toBe(200);
    expect(res.body.goal.targetDate).toBe(today);
  });
});
