import jwt, { type JwtPayload } from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { AUTH_COOKIE_NAME } from '../../../src/modules/auth/auth.cookie.js';
import { INVALID_LOGIN_CASES } from '../../fixtures/auth.fixtures.js';
import { DEFAULT_PASSWORD, insertUser, type SeededUser } from '../../helpers/db.js';
import { testEnv } from '../../helpers/env.js';
import { cookieValue, expectError, expectUserDTO, findSetCookie, getSetCookies } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';

const LOGIN_URL = '/api/v1/auth/login';
const INVALID_CREDENTIALS_BODY = {
  error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' },
};

describe('POST /api/v1/auth/login', () => {
  const ctx = useIntegrationContext();
  let ana: SeededUser;

  beforeEach(async () => {
    ana = await insertUser(ctx.pool, { email: 'ana@onepulse.dev', password: DEFAULT_PASSWORD });
  });

  const login = (body: object) => request(ctx.app).post(LOGIN_URL).send(body);

  it('[AUTH-07] com credenciais corretas, responde 200 com UserDTO e cookie de sessão seguro', async () => {
    const res = await login({ email: ana.email, password: ana.password });

    expect(res.status).toBe(200);
    expectUserDTO(res.body.user, { id: ana.id, email: ana.email, name: ana.name, role: 'COLABORADOR' });

    const cookie = findSetCookie(res, AUTH_COOKIE_NAME);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/;\s*HttpOnly/i);
    expect(cookie).toMatch(/;\s*SameSite=Lax/i);
    expect(cookie).toMatch(/;\s*Path=\/(;|$)/);
    expect(cookie).toMatch(/;\s*Max-Age=28800(;|$)/);
    expect(cookie).not.toMatch(/;\s*Secure/i); // NODE_ENV=test (AUTH-09)
  });

  it('[AUTH-08] o JWT fica só no cookie (fora do corpo) e carrega sub, role e expiração de 8h', async () => {
    const res = await login({ email: ana.email, password: ana.password });
    expect(res.status).toBe(200);

    const cookie = findSetCookie(res, AUTH_COOKIE_NAME);
    expect(cookie).toBeDefined();
    const token = cookieValue(cookie!);

    expect(JSON.stringify(res.body)).not.toContain(token);

    const payload = jwt.verify(token, testEnv.JWT_SECRET, { algorithms: ['HS256'] }) as JwtPayload;
    expect(payload.sub).toBe(String(ana.id));
    expect(payload['role']).toBe('COLABORADOR');
    expect(payload.exp! - payload.iat!).toBe(28_800);
    expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'role', 'sub']);
  });

  it('[AUTH-10] com senha errada, responde 401 INVALID_CREDENTIALS genérico e sem cookie', async () => {
    const res = await login({ email: ana.email, password: 'senhaErrada1' });

    expect(res.status).toBe(401);
    expect(res.body).toEqual(INVALID_CREDENTIALS_BODY);
    expect(getSetCookies(res)).toEqual([]);
  });

  it('[AUTH-11] com e-mail inexistente, responde EXATAMENTE como senha errada', async () => {
    const wrongPassword = await login({ email: ana.email, password: 'senhaErrada1' });
    const unknownEmail = await login({ email: 'ghost@onepulse.dev', password: 'senhaErrada1' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(wrongPassword.status);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
    expect(unknownEmail.body).toEqual(INVALID_CREDENTIALS_BODY);
    expect(getSetCookies(unknownEmail)).toEqual([]);
  });

  it('[AUTH-12] com usuário inativo e senha correta, responde EXATAMENTE como senha errada', async () => {
    const inactive = await insertUser(ctx.pool, { email: 'inativo@onepulse.dev', isActive: false });

    const res = await login({ email: inactive.email, password: inactive.password });

    expect(res.status).toBe(401);
    expect(res.body).toEqual(INVALID_CREDENTIALS_BODY);
    expect(getSetCookies(res)).toEqual([]);
  });

  it('[AUTH-13] normaliza o e-mail antes de buscar o usuário', async () => {
    const res = await login({ email: ' ANA@onepulse.dev', password: ana.password });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(ana.id);
  });

  it.each(INVALID_LOGIN_CASES)('[AUTH-14] responde 400 VALIDATION_ERROR quando %s', async (_description, payload) => {
    const res = await login(payload);

    expectError(res, 400, 'VALIDATION_ERROR');
    expect(getSetCookies(res)).toEqual([]);
  });
});
