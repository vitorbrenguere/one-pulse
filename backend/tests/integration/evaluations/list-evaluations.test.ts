import { beforeEach, describe, expect, it } from 'vitest';
import { INVALID_LIST_QUERIES } from '../../fixtures/evaluations.fixtures.js';
import { insertHierarchy, type Hierarchy } from '../../helpers/db.js';
import {
  evaluationsApi,
  expectValidationErrorOn,
  insertEvaluation,
  insertManagerOf,
  NONEXISTENT_ID,
  USER_NOT_FOUND_BODY,
  withManagerPartHidden,
  withSelfPartHidden,
  type EvaluationsApi,
  type SeededEvaluation,
} from '../../helpers/evaluations.js';
import { expectError } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';

describe('GET /api/v1/evaluations', () => {
  const ctx = useIntegrationContext();
  let h: Hierarchy;
  let api: EvaluationsApi;
  let e: Record<'c1Old' | 'c1New' | 'c1FromG2' | 'c2' | 'gOwn' | 'x' | 'ci', SeededEvaluation>;

  beforeEach(async () => {
    h = await insertHierarchy(ctx.pool);
    const GG = await insertManagerOf(ctx.pool, h.G);
    api = evaluationsApi(ctx.app);

    // As avaliações semeadas ou estão CONCLUIDA ou têm as partes vazias: assim o DTO
    // visível é igual ao completo, e os testes de listagem não dependem da ocultação
    // (que tem o próprio teste, EVAL-15).
    e = {
      c1Old: await insertEvaluation(ctx.pool, {
        userId: h.C1.id,
        managerId: h.G.id,
        cycle: '2026-S1',
        selfSubmitted: true,
        managerSubmitted: true,
      }),
      c1New: await insertEvaluation(ctx.pool, { userId: h.C1.id, managerId: h.G.id, cycle: '2026-S2' }),
      // Aberta por um ex-gestor de C1: aparece para C1, mas não para G (D-07).
      c1FromG2: await insertEvaluation(ctx.pool, { userId: h.C1.id, managerId: h.G2.id, cycle: '2025-S2' }),
      c2: await insertEvaluation(ctx.pool, { userId: h.C2.id, managerId: h.G.id, cycle: '2026-S2' }),
      gOwn: await insertEvaluation(ctx.pool, { userId: h.G.id, managerId: GG.id, cycle: '2026-S2' }),
      x: await insertEvaluation(ctx.pool, { userId: h.X.id, managerId: h.G2.id, cycle: '2026-S2' }),
      ci: await insertEvaluation(ctx.pool, { userId: h.Ci.id, managerId: h.G.id, cycle: '2026-S2' }),
    };
  });

  it('[EVAL-09] COLABORADOR lista só as próprias, ordenadas por cycle DESC, id ASC', async () => {
    const res = await api.list(h.C1);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['evaluations']);
    expect(res.body.evaluations).toEqual([e.c1New, e.c1Old, e.c1FromG2]);
  });

  it('[EVAL-10] GESTOR sem userId lista as da EQUIPE abertas por ele (sem a própria, a de outro time e a de inativo)', async () => {
    const res = await api.list(h.G);

    expect(res.status).toBe(200);
    // Mesmo ciclo → desempate por id (c1New foi inserida antes de c2).
    expect(res.body).toEqual({ evaluations: [e.c1New, e.c2, e.c1Old] });
  });

  it('[EVAL-11] GESTOR com ?userId=<liderado> lista as desse liderado abertas por ele', async () => {
    const res = await api.list(h.G, `?userId=${h.C1.id}`);

    expect(res.status).toBe(200);
    expect(res.body.evaluations).toEqual([e.c1New, e.c1Old]);
  });

  it('[EVAL-11] GESTOR com ?userId=<ele mesmo> lista as PRÓPRIAS (como avaliado)', async () => {
    const res = await api.list(h.G, `?userId=${h.G.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ evaluations: [e.gOwn] });
  });

  it('[EVAL-11] COLABORADOR com ?userId=<ele mesmo> equivale à listagem própria', async () => {
    const withQuery = await api.list(h.C1, `?userId=${h.C1.id}`);
    const withoutQuery = await api.list(h.C1);

    expect(withQuery.status).toBe(200);
    expect(withQuery.body).toEqual(withoutQuery.body);
  });

  it.each([
    ['GESTOR → colaborador de outro time', 'G', 'X'],
    ['GESTOR → liderado inativo', 'G', 'Ci'],
    ['GESTOR → liderado indireto', 'G', 'N'],
    ['GESTOR → usuário inexistente', 'G', null],
    ['COLABORADOR → par da mesma equipe', 'C1', 'C2'],
    ['COLABORADOR → o próprio gestor', 'C1', 'G'],
  ] as const)('[EVAL-12] %s → 404 "Usuário não encontrado." (corpo idêntico)', async (_d, viewerKey, targetKey) => {
    const userId = targetKey ? h[targetKey].id : NONEXISTENT_ID;

    const res = await api.list(h[viewerKey], `?userId=${userId}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(USER_NOT_FOUND_BODY);
  });

  it('[EVAL-13] ?cycle filtra em qualquer combinação; ciclo sem avaliações → []', async () => {
    const own = await api.list(h.C1, '?cycle=2026-S2');
    const team = await api.list(h.G, '?cycle=2026-S1');
    const member = await api.list(h.G, `?userId=${h.C1.id}&cycle=2026-S1`);
    const empty = await api.list(h.G, '?cycle=2024-S1');

    expect(own.body).toEqual({ evaluations: [e.c1New] });
    expect(team.body).toEqual({ evaluations: [e.c1Old] });
    expect(member.body).toEqual({ evaluations: [e.c1Old] });
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ evaluations: [] });
  });

  it.each(INVALID_LIST_QUERIES)('[EVAL-14] %s → 400 VALIDATION_ERROR', async (_d, query, _object, field) => {
    const res = await api.list(h.G, query);

    expectValidationErrorOn(res, field);
  });

  it('[EVAL-15] a ocultação anti-viés vale item a item na listagem', async () => {
    const mixed = await insertEvaluation(ctx.pool, {
      userId: h.C2.id,
      managerId: h.G.id,
      cycle: '2025-S1',
      selfScore: 4,
      selfComments: 'Rascunho da C2',
      managerScore: 2,
      managerFeedback: 'Precisa melhorar a comunicação.',
      managerSubmitted: true,
    });

    const asEvaluatee = await api.list(h.C2);
    const asEvaluator = await api.list(h.G, `?userId=${h.C2.id}`);

    expect(asEvaluatee.body.evaluations).toEqual([e.c2, withManagerPartHidden(mixed)]);
    expect(asEvaluator.body.evaluations).toEqual([e.c2, withSelfPartHidden(mixed)]);
  });

  it.each([
    ['sem query', ''],
    ['query inválida (401 vem antes do 400)', '?userId=abc'],
  ])('[EVAL-16] sem sessão → 401 UNAUTHENTICATED (%s)', async (_d, query) => {
    const res = await api.list(null, query);

    expectError(res, 401, 'UNAUTHENTICATED');
  });
});
