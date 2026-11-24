import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { FORBIDDEN_PROFILE_FIELDS, INVALID_PROFILE_BODIES } from '../../fixtures/users.fixtures.js';
import { findUserRowById, insertUser, type SeededUser } from '../../helpers/db.js';
import { expectError, expectUserDTO } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';
import { cookieFor } from '../../helpers/tokens.js';

const PROFILE_URL = '/api/v1/users/me';

describe('PATCH /api/v1/users/me', () => {
  const ctx = useIntegrationContext();
  let ana: SeededUser;

  beforeEach(async () => {
    const manager = await insertUser(ctx.pool, { name: 'Gabriela Martins', email: 'g@onepulse.dev', role: 'GESTOR' });
    ana = await insertUser(ctx.pool, { name: 'Ana Souza', email: 'ana@onepulse.dev', jobTitle: 'Estagiária', managerId: manager.id });
  });

  const patchProfile = (body: unknown, cookie: string | null = cookieFor(ana)) => {
    const req = request(ctx.app).patch(PROFILE_URL).set('Content-Type', 'application/json');
    return (cookie ? req.set('Cookie', cookie) : req).send(JSON.stringify(body));
  };

  it('[USER-18] atualiza name e jobTitle, persiste e reflete no GET /auth/me', async () => {
    const res = await patchProfile({ name: 'Ana Souza Lima', jobTitle: 'Desenvolvedora Júnior' });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['user']);
    expectUserDTO(res.body.user, {
      id: ana.id,
      name: 'Ana Souza Lima',
      email: ana.email,
      role: 'COLABORADOR',
      managerId: ana.managerId,
      jobTitle: 'Desenvolvedora Júnior',
    });

    const row = await findUserRowById(ctx.pool, ana.id);
    expect(row).toMatchObject({ name: 'Ana Souza Lima', job_title: 'Desenvolvedora Júnior' });

    const me = await request(ctx.app).get('/api/v1/auth/me').set('Cookie', cookieFor(ana));
    expect(me.status).toBe(200);
    expect(me.body.user).toEqual(res.body.user);
  });

  it('[USER-19] jobTitle: null remove o cargo (no corpo e no banco)', async () => {
    const res = await patchProfile({ jobTitle: null });

    expect(res.status).toBe(200);
    expect(res.body.user.jobTitle).toBeNull();
    expect((await findUserRowById(ctx.pool, ana.id))?.job_title).toBeNull();
  });

  it('[USER-20] enviar só name preserva o jobTitle anterior', async () => {
    const res = await patchProfile({ name: 'Ana Lima' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Ana Lima', jobTitle: 'Estagiária' });
    expect(await findUserRowById(ctx.pool, ana.id)).toMatchObject({ name: 'Ana Lima', job_title: 'Estagiária' });
  });

  it.each(FORBIDDEN_PROFILE_FIELDS)(
    '[USER-21] campo proibido "%s" → 400 com details[].field e NADA muda no banco',
    async (field, body) => {
      const before = await findUserRowById(ctx.pool, ana.id);

      const res = await patchProfile(body);

      expectError(res, 400, 'VALIDATION_ERROR');
      expect(res.body.error.details).toContainEqual({ field, message: expect.any(String) });
      expect(await findUserRowById(ctx.pool, ana.id)).toEqual(before);
    },
  );

  it.each(INVALID_PROFILE_BODIES)('[USER-22] corpo inválido (%s) → 400 VALIDATION_ERROR', async (_description, body, field) => {
    const before = await findUserRowById(ctx.pool, ana.id);

    const res = await patchProfile(body);

    expectError(res, 400, 'VALIDATION_ERROR');
    expect(res.body.error.details).toContainEqual({ field, message: expect.any(String) });
    expect(await findUserRowById(ctx.pool, ana.id)).toEqual(before);
  });

  it('[USER-23] sem sessão → 401 UNAUTHENTICATED', async () => {
    const res = await patchProfile({ name: 'Invasor' }, null);

    expectError(res, 401, 'UNAUTHENTICATED');
    expect((await findUserRowById(ctx.pool, ana.id))?.name).toBe('Ana Souza');
  });
});
