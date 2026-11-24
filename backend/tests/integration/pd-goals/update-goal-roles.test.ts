import { beforeEach, describe, expect, it } from 'vitest';
import { FORBIDDEN_UPDATE_FIELDS, INVALID_UPDATE_BODIES } from '../../fixtures/pd-goals.fixtures.js';
import { insertHierarchy, type Hierarchy } from '../../helpers/db.js';
import {
  expectValidationErrorOn,
  findGoalRowById,
  GOAL_NOT_FOUND_BODY,
  goalsApi,
  insertGoal,
  ISO_UTC_PATTERN,
  NONEXISTENT_ID,
  seededGoalDTO,
  type GoalsApi,
  type SeededGoal,
} from '../../helpers/goals.js';
import { expectError } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';

describe('PATCH /api/v1/pd-goals/:id (papéis e parecer do gestor)', () => {
  const ctx = useIntegrationContext();
  let h: Hierarchy;
  let api: GoalsApi;
  let c1Goal: SeededGoal;

  beforeEach(async () => {
    h = await insertHierarchy(ctx.pool);
    api = goalsApi(ctx.app);
    c1Goal = await insertGoal(ctx.pool, {
      userId: h.C1.id,
      title: 'Aprender testes',
      description: 'Cobrir a API.',
      status: 'EM_ANDAMENTO',
      progress: 40,
    });
  });

  /** Snapshot da linha, para provar que "nada muda" após uma recusa. */
  const rowOf = (id: number) => findGoalRowById(ctx.pool, id);

  it('[GOAL-29] gestor direto registra o parecer → 200, só os campos do parecer mudam', async () => {
    const res = await api.update(h.G, c1Goal.id, { managerFeedback: '  Ótimo avanço, inclua testes de RBAC.  ' });

    expect(res.status).toBe(200);
    const { managerFeedback, managerFeedbackAt, updatedAt, ...rest } = res.body.goal;
    expect(managerFeedback).toBe('Ótimo avanço, inclua testes de RBAC.');
    expect(managerFeedbackAt).toMatch(ISO_UTC_PATTERN);
    expect(updatedAt).toMatch(ISO_UTC_PATTERN);
    const { managerFeedback: _f, managerFeedbackAt: _fa, updatedAt: _u, ...expectedRest } = seededGoalDTO(c1Goal);
    expect(rest).toEqual(expectedRest);

    const row = await rowOf(c1Goal.id);
    expect(row?.manager_feedback).toBe('Ótimo avanço, inclua testes de RBAC.');
    expect(row?.manager_feedback_at).toBeInstanceOf(Date);
  });

  it('[GOAL-29] managerFeedback: null remove o parecer e o managerFeedbackAt', async () => {
    const goal = await insertGoal(ctx.pool, { userId: h.C1.id, managerFeedback: 'Parecer antigo' });

    const res = await api.update(h.G, goal.id, { managerFeedback: null });

    expect(res.status).toBe(200);
    expect(res.body.goal).toMatchObject({ managerFeedback: null, managerFeedbackAt: null });
    expect(await rowOf(goal.id)).toMatchObject({ manager_feedback: null, manager_feedback_at: null });
  });

  it.each(['CONCLUIDA', 'CANCELADA'] as const)(
    '[GOAL-30] parecer em meta %s → 200 (o parecer não é travado pelo estado terminal)',
    async (status) => {
      const goal = await insertGoal(ctx.pool, { userId: h.C1.id, status });

      const res = await api.update(h.G, goal.id, { managerFeedback: 'Parabéns pela entrega.' });

      expect(res.status).toBe(200);
      expect(res.body.goal).toMatchObject({ status, managerFeedback: 'Parabéns pela entrega.' });
      expect(res.body.goal.managerFeedbackAt).toMatch(ISO_UTC_PATTERN);
    },
  );

  it.each([
    ['title', { title: 'Título do gestor' }],
    ['description', { description: null }],
    ['category', { category: 'CARREIRA' }],
    ['targetDate', { targetDate: '2099-06-30' }],
    ['status', { status: 'CANCELADA' }],
    ['progress', { progress: 10 }],
  ])('[GOAL-31] gestor envia campo do dono (%s) → 403 FORBIDDEN, nada muda', async (_field, body) => {
    const before = await rowOf(c1Goal.id);

    const res = await api.update(h.G, c1Goal.id, body);

    expectError(res, 403, 'FORBIDDEN');
    expect(await rowOf(c1Goal.id)).toEqual(before);
  });

  it('[GOAL-32] dono envia managerFeedback na própria meta → 403, nada muda', async () => {
    const before = await rowOf(c1Goal.id);

    const res = await api.update(h.C1, c1Goal.id, { managerFeedback: 'Eu mesmo me elogio.' });

    expectError(res, 403, 'FORBIDDEN');
    expect(await rowOf(c1Goal.id)).toEqual(before);
  });

  it('[GOAL-32] GESTOR envia managerFeedback na PRÓPRIA meta → 403 (o parecer é do gestor do dono)', async () => {
    const gGoal = await insertGoal(ctx.pool, { userId: h.G.id });
    const before = await rowOf(gGoal.id);

    const res = await api.update(h.G, gGoal.id, { managerFeedback: 'Autoparecer.' });

    expectError(res, 403, 'FORBIDDEN');
    expect(await rowOf(gGoal.id)).toEqual(before);
  });

  it('[GOAL-33] payload misto do gestor (managerFeedback + title) → 403, NEM o parecer NEM o título mudam', async () => {
    const before = await rowOf(c1Goal.id);

    const res = await api.update(h.G, c1Goal.id, { managerFeedback: 'Bom trabalho.', title: 'Título do gestor' });

    expectError(res, 403, 'FORBIDDEN');
    expect(await rowOf(c1Goal.id)).toEqual(before);
  });

  it('[GOAL-34] gestor envia title em meta TERMINAL do liderado → 403 (papel antes do estado), não 409', async () => {
    const goal = await insertGoal(ctx.pool, { userId: h.C1.id, status: 'CONCLUIDA' });

    const res = await api.update(h.G, goal.id, { title: 'Título do gestor' });

    expectError(res, 403, 'FORBIDDEN');
  });

  it.each([
    ['colaborador de outro time', 'X', { title: 'Invasão' }],
    ['par da mesma equipe', 'C2', { title: 'Invasão' }],
    ['gestor de outro time enviando parecer', 'G2', { managerFeedback: 'Parecer alheio' }],
    ['colaborador de outro time enviando parecer', 'X', { managerFeedback: 'Parecer alheio' }],
  ] as const)('[GOAL-35] PATCH por %s → 404 "Meta não encontrada.", nada muda', async (_description, viewerKey, body) => {
    const before = await rowOf(c1Goal.id);

    const res = await api.update(h[viewerKey], c1Goal.id, body);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(GOAL_NOT_FOUND_BODY);
    expect(await rowOf(c1Goal.id)).toEqual(before);
  });

  it('[GOAL-35] PATCH em meta inexistente → 404 com o mesmo corpo', async () => {
    const res = await api.update(h.C1, NONEXISTENT_ID, { title: 'Novo título' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual(GOAL_NOT_FOUND_BODY);
  });

  it.each([
    ['corpo vazio', {}, 'body'],
    ['progress inválido', { progress: 101 }, 'progress'],
  ])('[GOAL-36] usuário FORA do escopo com %s → 400 (validação antes do escopo)', async (_description, body, field) => {
    const res = await api.update(h.X, c1Goal.id, body);

    expectValidationErrorOn(res, field);
  });

  it.each(INVALID_UPDATE_BODIES)('[GOAL-37] %s → 400 VALIDATION_ERROR, nada muda', async (_description, body, field) => {
    const before = await rowOf(c1Goal.id);

    const res = await api.update(h.C1, c1Goal.id, body);

    expectValidationErrorOn(res, field);
    expect(await rowOf(c1Goal.id)).toEqual(before);
  });

  it.each(FORBIDDEN_UPDATE_FIELDS)('[GOAL-37] campo proibido "%s" → 400, nada muda', async (field, body) => {
    const before = await rowOf(c1Goal.id);

    const res = await api.update(h.C1, c1Goal.id, body);

    expectValidationErrorOn(res, field);
    expect(await rowOf(c1Goal.id)).toEqual(before);
  });

  it.each([
    ['corpo válido', { title: 'Novo título' }],
    ['corpo inválido (401 vem antes do 400)', {}],
  ])('[GOAL-38] sem sessão → 401 UNAUTHENTICATED (%s)', async (_description, body) => {
    const before = await rowOf(c1Goal.id);

    const res = await api.update(null, c1Goal.id, body);

    expectError(res, 401, 'UNAUTHENTICATED');
    expect(await rowOf(c1Goal.id)).toEqual(before);
  });
});
