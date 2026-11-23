import type { CookieOptions } from 'express';
import type { Env } from '../../config/env.js';

/** Nome do cookie de sessão (spec 01-auth §2.1). */
export const AUTH_COOKIE_NAME = 'onepulse_token';

/**
 * Opções do cookie de sessão: HttpOnly, SameSite=Lax, Path=/, Secure só em produção.
 * `maxAgeSeconds` é convertido para milissegundos (unidade usada pelo Express).
 */
export function buildAuthCookieOptions(nodeEnv: Env['NODE_ENV'], maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  };
}

/**
 * Para limpar um cookie, o navegador exige os MESMOS atributos de quando ele foi criado.
 * O Express 5 ignora `maxAge` no clearCookie e define `Expires` no passado.
 */
export function buildClearAuthCookieOptions(nodeEnv: Env['NODE_ENV']): CookieOptions {
  const { maxAge: _ignored, ...options } = buildAuthCookieOptions(nodeEnv, 0);
  return options;
}
