import bcrypt from 'bcrypt';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  INVALID_REGISTER_BODY_CASES,
  INVALID_REGISTER_FIELD_CASES,
  MASS_ASSIGNMENT_CASES,
  VALID_REGISTER,
} from '../../fixtures/auth.fixtures.js';
import { countUsers, findUserRowByEmail, insertUser } from '../../helpers/db.js';
import { expectError, expectUserDTO, getSetCookies } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';

const REGISTER_URL = '/api/v1/auth/register';

describe('POST /api/v1/auth/register', () => {
  const ctx = useIntegrationContext();

  it('[AUTH-01] cria um COLABORADOR e responde 201 com UserDTO, sem Set-Cookie', async () => {
    const res = await request(ctx.app).post(REGISTER_URL).send(VALID_REGISTER);

    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(['user']);
    expectUserDTO(res.body.user, {
      name: VALID_REGISTER.name,
      email: VALID_REGISTER.email,
      role: 'COLABORADOR',
      managerId: null,
    });
    expect(getSetCookies(res)).toEqual([]);
  });

  it('[AUTH-02] persiste a senha como hash bcrypt, nunca em texto puro', async () => {
    const res = await request(ctx.app).post(REGISTER_URL).send(VALID_REGISTER);
    expect(res.status).toBe(201);

    const row = await findUserRowByEmail(ctx.pool, VALID_REGISTER.email);

    expect(row).toBeDefined();
    expect(row!.password_hash).not.toBe(VALID_REGISTER.password);
    expect(row!.password_hash).toMatch(/^\$2[aby]\$/);
    await expect(bcrypt.compare(VALID_REGISTER.password, row!.password_hash)).resolves.toBe(true);
  });

  it('[AUTH-03] normaliza o e-mail (trim + lowercase) ao persistir e ao responder', async () => {
    const res = await request(ctx.app)
      .post(REGISTER_URL)
      .send({ ...VALID_REGISTER, email: '  Ana@OnePulse.DEV ' });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('ana@onepulse.dev');
    expect(await findUserRowByEmail(ctx.pool, 'ana@onepulse.dev')).toBeDefined();
  });

  it('[AUTH-04] responde 409 EMAIL_ALREADY_IN_USE para e-mail já cadastrado (sem diferenciar maiúsculas)', async () => {
    await insertUser(ctx.pool, { email: 'ana@onepulse.dev' });

    const res = await request(ctx.app)
      .post(REGISTER_URL)
      .send({ ...VALID_REGISTER, email: 'ANA@onepulse.dev' });

    expectError(res, 409, 'EMAIL_ALREADY_IN_USE');
    expect(await countUsers(ctx.pool)).toBe(1);
  });

  it.each(INVALID_REGISTER_FIELD_CASES)(
    '[AUTH-05] responde 400 VALIDATION_ERROR quando %s',
    async (_description, payload, field) => {
      const res = await request(ctx.app).post(REGISTER_URL).send(payload);

      expectError(res, 400, 'VALIDATION_ERROR');
      expect(res.body.error.details).toContainEqual({ field, message: expect.any(String) });
      expect(await countUsers(ctx.pool)).toBe(0);
    },
  );

  it.each(INVALID_REGISTER_BODY_CASES)(
    '[AUTH-05] responde 400 VALIDATION_ERROR para corpo inválido: %s',
    async (_description, payload) => {
      const res = await request(ctx.app)
        .post(REGISTER_URL)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(payload));

      expectError(res, 400, 'VALIDATION_ERROR');
      expect(res.body.error.details).toEqual(expect.any(Array));
      expect(res.body.error.details.length).toBeGreaterThan(0);
      expect(await countUsers(ctx.pool)).toBe(0);
    },
  );

  it.each(MASS_ASSIGNMENT_CASES)(
    '[AUTH-06] rejeita mass assignment (%s) com 400 e não cria usuário',
    async (_description, payload) => {
      const res = await request(ctx.app).post(REGISTER_URL).send(payload);

      expectError(res, 400, 'VALIDATION_ERROR');
      expect(await countUsers(ctx.pool)).toBe(0);
    },
  );
});
