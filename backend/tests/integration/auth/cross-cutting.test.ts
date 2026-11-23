import type { Pool } from 'mysql2/promise';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../../src/app.js';
import { AUTH_COOKIE_NAME } from '../../../src/modules/auth/auth.cookie.js';
import { VALID_LOGIN, VALID_REGISTER } from '../../fixtures/auth.fixtures.js';
import { testEnv } from '../../helpers/env.js';
import { collectKeysDeep, cookieValue, expectError, findSetCookie } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';
import { authCookie } from '../../helpers/tokens.js';

const FORBIDDEN_KEYS = ['password', 'passwordHash', 'password_hash', 'isActive', 'is_active'];

describe('Auth: requisitos transversais', () => {
  const ctx = useIntegrationContext();

  it.each(['/api/v1/auth/register', '/api/v1/auth/login', '/api/v1/auth/logout'])(
    '[AUTH-25] JSON mal formado em POST %s responde 400 INVALID_JSON',
    async (url) => {
      const res = await request(ctx.app).post(url).set('Content-Type', 'application/json').send('{"email": "ana@');

      expectError(res, 400, 'INVALID_JSON');
    },
  );

  it('[AUTH-26] nenhuma resposta de sucesso expõe senha, hash ou flags internas', async () => {
    const registered = await request(ctx.app).post('/api/v1/auth/register').send(VALID_REGISTER);
    expect(registered.status).toBe(201);

    const loggedIn = await request(ctx.app).post('/api/v1/auth/login').send(VALID_LOGIN);
    expect(loggedIn.status).toBe(200);

    const cookie = findSetCookie(loggedIn, AUTH_COOKIE_NAME);
    expect(cookie).toBeDefined();
    const me = await request(ctx.app).get('/api/v1/auth/me').set('Cookie', authCookie(cookieValue(cookie!)));
    expect(me.status).toBe(200);

    const responses = { register: registered, login: loggedIn, me };
    for (const [route, res] of Object.entries(responses)) {
      const keys = collectKeysDeep(res.body);
      for (const forbidden of FORBIDDEN_KEYS) {
        expect(keys.has(forbidden), `chave proibida "${forbidden}" em ${route}`).toBe(false);
      }
      expect(JSON.stringify(res.body)).not.toContain(VALID_REGISTER.password);
      expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
    }
  });

  describe('[AUTH-27] erro inesperado (banco fora do ar)', () => {
    const INTERNAL_DETAIL = 'connect ECONNREFUSED 10.0.0.42:3306 (segredo-interno)';

    /** Pool falso: qualquer método rejeita com um erro que contém detalhes internos. */
    const brokenPool = new Proxy(
      {},
      {
        get: (_target, prop) => (prop === 'then' ? undefined : () => Promise.reject(new Error(INTERNAL_DETAIL))),
      },
    ) as unknown as Pool;

    const brokenApp = createApp({ env: testEnv, pool: brokenPool });

    it.each([
      ['POST /auth/register', () => request(brokenApp).post('/api/v1/auth/register').send(VALID_REGISTER)],
      ['POST /auth/login', () => request(brokenApp).post('/api/v1/auth/login').send(VALID_LOGIN)],
    ])('[AUTH-27] %s responde 500 INTERNAL_ERROR sem vazar detalhes internos', async (_route, send) => {
      const res = await send();

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: expect.any(String) } });

      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain('ECONNREFUSED');
      expect(raw).not.toContain('segredo-interno');
      expect(raw).not.toMatch(/stack|\.ts:\d+|at\s+\w+\s*\(/i);
    });
  });
});
