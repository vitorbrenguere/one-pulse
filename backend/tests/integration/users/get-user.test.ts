import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { INVALID_USER_IDS } from '../../fixtures/users.fixtures.js';
import { insertHierarchy, type Hierarchy, type SeededUser } from '../../helpers/db.js';
import { expectError, expectUserDTO } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';
import { cookieFor } from '../../helpers/tokens.js';

const userUrl = (id: number | string) => `/api/v1/users/${id}`;

/** Spec 02 §2.4: corpo ÚNICO para "não existe" e "fora do escopo". */
const NOT_FOUND_BODY = { error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } };
const NONEXISTENT_ID = 999_999;

describe('GET /api/v1/users/:id', () => {
  const ctx = useIntegrationContext();
  let h: Hierarchy;

  beforeEach(async () => {
    h = await insertHierarchy(ctx.pool);
  });

  const getUser = (viewer: SeededUser | null, id: number | string) => {
    const req = request(ctx.app).get(userUrl(id));
    return viewer ? req.set('Cookie', cookieFor(viewer)) : req;
  };

  /** RBAC-03: além de 404, o corpo é idêntico ao de um id inexistente. */
  async function expectIndistinguishableFromNonexistent(viewer: SeededUser, targetId: number): Promise<void> {
    const outOfScope = await getUser(viewer, targetId);
    const nonexistent = await getUser(viewer, NONEXISTENT_ID);

    expect(outOfScope.status).toBe(404);
    expect(outOfScope.body).toEqual(NOT_FOUND_BODY);
    expect(outOfScope.body).toEqual(nonexistent.body);
  }

  it.each(['G', 'C1'] as const)('[USER-07] %s consulta o próprio id → 200 com o próprio UserDTO', async (who) => {
    const self = h[who];

    const res = await getUser(self, self.id);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['user']);
    expectUserDTO(res.body.user, {
      id: self.id,
      name: self.name,
      email: self.email,
      role: self.role,
      managerId: self.managerId,
      jobTitle: self.jobTitle,
    });
  });

  it('[USER-08] GESTOR consulta liderado direto → 200', async () => {
    const res = await getUser(h.G, h.C1.id);

    expect(res.status).toBe(200);
    expectUserDTO(res.body.user, {
      id: h.C1.id,
      name: h.C1.name,
      email: h.C1.email,
      role: 'COLABORADOR',
      managerId: h.G.id,
      jobTitle: h.C1.jobTitle,
    });
  });

  it('[USER-09] GESTOR consulta colaborador de OUTRO time → 404 indistinguível', async () => {
    await expectIndistinguishableFromNonexistent(h.G, h.X.id);
  });

  it('[USER-10] COLABORADOR consulta par da mesma equipe → 404 indistinguível', async () => {
    await expectIndistinguishableFromNonexistent(h.C1, h.C2.id);
  });

  it('[USER-11] COLABORADOR consulta o próprio gestor → 404 indistinguível', async () => {
    await expectIndistinguishableFromNonexistent(h.C1, h.G.id);
  });

  it('[USER-12] GESTOR consulta liderado INDIRETO → 404 indistinguível', async () => {
    await expectIndistinguishableFromNonexistent(h.G, h.N.id);
  });

  it('[USER-13] GESTOR consulta liderado direto INATIVO → 404 indistinguível', async () => {
    await expectIndistinguishableFromNonexistent(h.G, h.Ci.id);
  });

  it('[USER-14] id inexistente → 404 NOT_FOUND com a mensagem da spec', async () => {
    const res = await getUser(h.G, NONEXISTENT_ID);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(NOT_FOUND_BODY);
  });

  it.each(INVALID_USER_IDS)('[USER-15] :id inválido "%s" → 400 VALIDATION_ERROR no campo id', async (rawId) => {
    const res = await getUser(h.C1, rawId);

    expectError(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.details).toContainEqual({ field: 'id', message: expect.any(String) });
  });

  it.each([
    ['id válido', String(NONEXISTENT_ID)],
    ['id inválido (401 vem antes do 400)', 'abc'],
  ])('[USER-16] sem sessão → 401 UNAUTHENTICATED (%s)', async (_description, rawId) => {
    const res = await getUser(null, rawId);

    expectError(res, 401, 'UNAUTHENTICATED');
  });
});
