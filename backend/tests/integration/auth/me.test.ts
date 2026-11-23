import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { insertUser, type SeededUser } from '../../helpers/db.js';
import { expectError, expectUserDTO } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';
import {
  authCookie,
  buildUnsignedToken,
  signExpiredToken,
  signTestToken,
  tamperSignature,
} from '../../helpers/tokens.js';

const ME_URL = '/api/v1/auth/me';

describe('GET /api/v1/auth/me', () => {
  const ctx = useIntegrationContext();
  let ana: SeededUser;
  let validToken: string;

  beforeEach(async () => {
    ana = await insertUser(ctx.pool, { name: 'Ana Souza', email: 'ana@onepulse.dev' });
    validToken = signTestToken({ sub: String(ana.id), role: ana.role });
  });

  const getMe = (cookie?: string) => {
    const req = request(ctx.app).get(ME_URL);
    return cookie ? req.set('Cookie', cookie) : req;
  };

  it('[AUTH-18] com cookie válido, responde 200 com o UserDTO do dono do token', async () => {
    const res = await getMe(authCookie(validToken));

    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(['user']);
    expectUserDTO(res.body.user, { id: ana.id, name: ana.name, email: ana.email, role: 'COLABORADOR' });
  });

  it('[AUTH-19] reflete alterações feitas no banco após o login (dados não vêm do JWT)', async () => {
    await ctx.pool.execute('UPDATE users SET name = ? WHERE id = ?', ['Ana Souza Lima', ana.id]);

    const res = await getMe(authCookie(validToken));

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Ana Souza Lima');
  });

  it('[AUTH-20] sem cookie, responde 401 UNAUTHENTICATED', async () => {
    const res = await getMe();

    expectError(res, 401, 'UNAUTHENTICATED');
  });

  it.each([
    ['assinatura adulterada', (token: string) => tamperSignature(token)],
    ['assinado com outro segredo', () => signTestToken({ sub: '1', role: 'GESTOR' }, { secret: 'y'.repeat(40) })],
    ['string aleatória', () => 'isto-nao-e-um-jwt'],
    ['alg: none (sem assinatura)', () => buildUnsignedToken({ sub: '1', role: 'GESTOR' })],
  ])('[AUTH-21] com token inválido (%s), responde 401 UNAUTHENTICATED', async (_description, makeToken) => {
    const res = await getMe(authCookie(makeToken(validToken)));

    expectError(res, 401, 'UNAUTHENTICATED');
  });

  it('[AUTH-22] com token expirado, responde 401 UNAUTHENTICATED', async () => {
    const expired = signExpiredToken({ sub: String(ana.id), role: ana.role });

    const res = await getMe(authCookie(expired));

    expectError(res, 401, 'UNAUTHENTICATED');
  });

  it('[AUTH-23] com token válido de usuário EXCLUÍDO após o login, responde 401', async () => {
    await ctx.pool.execute('DELETE FROM users WHERE id = ?', [ana.id]);

    const res = await getMe(authCookie(validToken));

    expectError(res, 401, 'UNAUTHENTICATED');
  });

  it('[AUTH-23] com token válido de usuário DESATIVADO após o login, responde 401', async () => {
    await ctx.pool.execute('UPDATE users SET is_active = FALSE WHERE id = ?', [ana.id]);

    const res = await getMe(authCookie(validToken));

    expectError(res, 401, 'UNAUTHENTICATED');
  });

  it('[AUTH-24] ignora o header Authorization: Bearer (somente o cookie é aceito)', async () => {
    const res = await request(ctx.app).get(ME_URL).set('Authorization', `Bearer ${validToken}`);

    expectError(res, 401, 'UNAUTHENTICATED');
  });
});
