import { beforeEach, describe, expect, it } from 'vitest';
import {
  FORBIDDEN_CREATE_FIELDS,
  INVALID_CREATE_BODIES,
  VALID_CYCLE,
} from '../../fixtures/evaluations.fixtures.js';
import { insertHierarchy, type Hierarchy } from '../../helpers/db.js';
import {
  ALREADY_EXISTS_BODY,
  countEvaluations,
  evaluationsApi,
  expectEvaluationDTO,
  expectValidationErrorOn,
  findEvaluationRowById,
  insertEvaluation,
  NONEXISTENT_ID,
  USER_NOT_FOUND_BODY,
  type EvaluationsApi,
} from '../../helpers/evaluations.js';
import { expectError } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';

describe('POST /api/v1/evaluations', () => {
  const ctx = useIntegrationContext();
  let h: Hierarchy;
  let api: EvaluationsApi;

  beforeEach(async () => {
    h = await insertHierarchy(ctx.pool);
    api = evaluationsApi(ctx.app);
  });

  it('[EVAL-01] GESTOR abre avaliação para liderado direto → 201 com as partes vazias e persistida', async () => {
    const res = await api.create(h.G, { userId: h.C1.id, cycle: VALID_CYCLE });

    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(['evaluation']);
    expectEvaluationDTO(res.body.evaluation, { userId: h.C1.id, managerId: h.G.id, cycle: VALID_CYCLE });

    expect(await findEvaluationRowById(ctx.pool, res.body.evaluation.id)).toMatchObject({
      user_id: h.C1.id,
      manager_id: h.G.id,
      cycle: VALID_CYCLE,
      status: 'ABERTA',
      self_score: null,
      self_comments: null,
      self_submitted_at: null,
      manager_score: null,
      manager_feedback: null,
      manager_submitted_at: null,
    });
    expect(await countEvaluations(ctx.pool)).toBe(1);
  });

  it('[EVAL-02] avaliação já existente para (userId, cycle) → 409 EVALUATION_ALREADY_EXISTS; outro ciclo → 201', async () => {
    await insertEvaluation(ctx.pool, { userId: h.C1.id, managerId: h.G.id, cycle: '2026-S2' });

    const duplicate = await api.create(h.G, { userId: h.C1.id, cycle: '2026-S2' });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual(ALREADY_EXISTS_BODY);
    expect(await countEvaluations(ctx.pool)).toBe(1);

    const otherCycle = await api.create(h.G, { userId: h.C1.id, cycle: '2026-S1' });

    expect(otherCycle.status).toBe(201);
    expect(otherCycle.body.evaluation).toMatchObject({ userId: h.C1.id, cycle: '2026-S1' });
    expect(await countEvaluations(ctx.pool)).toBe(2);
  });

  it.each([
    ['colaborador de outro time', 'X'],
    ['liderado inativo', 'Ci'],
    ['liderado indireto', 'N'],
    ['usuário inexistente', null],
  ] as const)('[EVAL-03] GESTOR → %s → 404 "Usuário não encontrado." sem criar avaliação', async (_d, targetKey) => {
    const userId = targetKey ? h[targetKey].id : NONEXISTENT_ID;

    const res = await api.create(h.G, { userId, cycle: VALID_CYCLE });

    expect(res.status).toBe(404);
    expect(res.body).toEqual(USER_NOT_FOUND_BODY);
    expect(await countEvaluations(ctx.pool)).toBe(0);
  });

  it.each([
    ['COLABORADOR abre para si', 'C1', 'C1'],
    ['COLABORADOR abre para par da equipe', 'C1', 'C2'],
    ['GESTOR abre para si mesmo', 'G', 'G'],
  ] as const)('[EVAL-04] %s → 403 FORBIDDEN sem criar avaliação', async (_d, viewerKey, targetKey) => {
    const res = await api.create(h[viewerKey], { userId: h[targetKey].id, cycle: VALID_CYCLE });

    expectError(res, 403, 'FORBIDDEN');
    expect(await countEvaluations(ctx.pool)).toBe(0);
  });

  it('[EVAL-04] COLABORADOR com corpo inválido → 403 (o papel é checado antes do corpo, §2.7)', async () => {
    const res = await api.create(h.C1, {});

    expectError(res, 403, 'FORBIDDEN');
  });

  it.each(INVALID_CREATE_BODIES)('[EVAL-05] %s → 400 VALIDATION_ERROR sem criar avaliação', async (_d, body, field) => {
    const res = await api.create(h.G, body);

    expectValidationErrorOn(res, field);
    expect(await countEvaluations(ctx.pool)).toBe(0);
  });

  it.each(FORBIDDEN_CREATE_FIELDS)('[EVAL-06] campo proibido "%s" → 400 sem criar avaliação', async (field, body) => {
    const res = await api.create(h.G, { ...body, userId: h.C1.id });

    expectValidationErrorOn(res, field);
    expect(await countEvaluations(ctx.pool)).toBe(0);
  });

  it.each([
    ['corpo válido', () => ({ userId: h.C1.id, cycle: VALID_CYCLE })],
    ['corpo inválido (401 vem antes do 400)', () => ({})],
  ])('[EVAL-07] sem sessão → 401 UNAUTHENTICATED (%s)', async (_d, body) => {
    const res = await api.create(null, body());

    expectError(res, 401, 'UNAUTHENTICATED');
    expect(await countEvaluations(ctx.pool)).toBe(0);
  });
});
