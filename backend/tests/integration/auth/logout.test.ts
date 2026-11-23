import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { AUTH_COOKIE_NAME } from '../../../src/modules/auth/auth.cookie.js';
import { insertUser } from '../../helpers/db.js';
import { findSetCookie } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';
import { authCookie, signTestToken } from '../../helpers/tokens.js';

const LOGOUT_URL = '/api/v1/auth/logout';

describe('POST /api/v1/auth/logout', () => {
  const ctx = useIntegrationContext();

  it('[AUTH-16] com sessão ativa, responde 204 e expira o cookie mantendo os mesmos atributos', async () => {
    const ana = await insertUser(ctx.pool);
    const token = signTestToken({ sub: String(ana.id), role: ana.role });

    const res = await request(ctx.app).post(LOGOUT_URL).set('Cookie', authCookie(token));

    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    const cleared = findSetCookie(res, AUTH_COOKIE_NAME);
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(new RegExp(`^${AUTH_COOKIE_NAME}=;`));
    expect(cleared).toMatch(/;\s*(Max-Age=0|Expires=Thu, 01 Jan 1970 00:00:00 GMT)/i);
    expect(cleared).toMatch(/;\s*HttpOnly/i);
    expect(cleared).toMatch(/;\s*SameSite=Lax/i);
    expect(cleared).toMatch(/;\s*Path=\/(;|$)/);
  });

  it('[AUTH-17] sem cookie, também responde 204 (idempotente)', async () => {
    const res = await request(ctx.app).post(LOGOUT_URL);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });
});
