import type { RequestHandler } from 'express';
import { AUTH_COOKIE_NAME } from './auth.cookie.js';
import { unauthenticated, type AuthService, type TokenService } from './auth.service.js';

/**
 * Protege rotas: aceita o token SOMENTE do cookie httpOnly (o header Authorization
 * é ignorado: AUTH-24), valida o JWT e carrega o usuário ATIVO do banco (AUTH-19/23).
 * Qualquer falha gera o mesmo 401, sem indicar ao cliente qual verificação falhou.
 */
export function createRequireAuth(deps: { authService: AuthService; tokenService: TokenService }): RequestHandler {
  return async (req, _res, next) => {
    const token: unknown = req.cookies?.[AUTH_COOKIE_NAME];
    if (typeof token !== 'string' || token.length === 0) throw unauthenticated();

    let userId: number;
    try {
      userId = Number(deps.tokenService.verify(token).sub);
    } catch {
      throw unauthenticated();
    }
    if (!Number.isSafeInteger(userId) || userId <= 0) throw unauthenticated();

    req.user = await deps.authService.getCurrentUser(userId);
    next();
  };
}
