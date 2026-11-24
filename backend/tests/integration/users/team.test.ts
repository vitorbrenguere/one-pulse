import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { insertHierarchy, insertUser, type Hierarchy } from '../../helpers/db.js';
import { expectError, expectUserDTO } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';
import { cookieFor } from '../../helpers/tokens.js';

const TEAM_URL = '/api/v1/users/team';

describe('GET /api/v1/users/team', () => {
  const ctx = useIntegrationContext();
  let h: Hierarchy;

  beforeEach(async () => {
    h = await insertHierarchy(ctx.pool);
  });

  const getTeam = (cookie?: string) => {
    const req = request(ctx.app).get(TEAM_URL);
    return cookie ? req.set('Cookie', cookie) : req;
  };

  it('[USER-01] GESTOR recebe exatamente os liderados diretos ativos, como UserDTO, ordenados por nome', async () => {
    const res = await getTeam(cookieFor(h.G));

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['users']);
    expect(res.body.users).toHaveLength(2);
    // "Camila Rocha" < "Carlos Lima"
    expectUserDTO(res.body.users[0], {
      id: h.C2.id,
      name: h.C2.name,
      email: h.C2.email,
      role: 'COLABORADOR',
      managerId: h.G.id,
      jobTitle: h.C2.jobTitle,
    });
    expectUserDTO(res.body.users[1], {
      id: h.C1.id,
      name: h.C1.name,
      email: h.C1.email,
      role: 'COLABORADOR',
      managerId: h.G.id,
      jobTitle: h.C1.jobTitle,
    });
  });

  it('[USER-01] desempata nomes iguais pelo id (ordem determinística)', async () => {
    const first = await insertUser(ctx.pool, { name: 'Bruno Costa', email: 'b1@onepulse.dev', managerId: h.G2.id });
    const second = await insertUser(ctx.pool, { name: 'Bruno Costa', email: 'b2@onepulse.dev', managerId: h.G2.id });

    const res = await getTeam(cookieFor(h.G2));

    expect(res.status).toBe(200);
    expect(res.body.users.map((u: { id: number }) => u.id)).toEqual([first.id, second.id, h.X.id]);
  });

  it('[USER-02] liderado inativo NÃO aparece', async () => {
    const res = await getTeam(cookieFor(h.G));

    expect(res.status).toBe(200);
    expect(res.body.users.map((u: { id: number }) => u.id)).not.toContain(h.Ci.id);
  });

  it('[USER-03] não inclui o próprio gestor, outro time nem liderados indiretos', async () => {
    const res = await getTeam(cookieFor(h.G));

    expect(res.status).toBe(200);
    const ids = res.body.users.map((u: { id: number }) => u.id);
    expect(ids).not.toContain(h.G.id);
    expect(ids).not.toContain(h.X.id);
    expect(ids).not.toContain(h.N.id);
  });

  it('[USER-04] GESTOR sem liderados recebe 200 com lista vazia', async () => {
    const lonely = await insertUser(ctx.pool, { name: 'Gestor Sem Time', email: 'g3@onepulse.dev', role: 'GESTOR' });

    const res = await getTeam(cookieFor(lonely));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ users: [] });
  });

  it('[USER-05] COLABORADOR recebe 403 FORBIDDEN', async () => {
    const res = await getTeam(cookieFor(h.C1));

    expectError(res, 403, 'FORBIDDEN');
    expect(res.body.error.message).toBe('Você não tem permissão para esta ação.');
  });

  it('[USER-06] sem sessão recebe 401 UNAUTHENTICATED', async () => {
    const res = await getTeam();

    expectError(res, 401, 'UNAUTHENTICATED');
  });
});
