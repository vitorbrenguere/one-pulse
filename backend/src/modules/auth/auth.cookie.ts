import type { CookieOptions } from 'express';
import type { Env } from '../../config/env.js';
import { NotImplementedError } from '../../shared/errors/not-implemented.error.js';

/** Nome do cookie de sessão (spec 01-auth §2.1). */
export const AUTH_COOKIE_NAME = 'onepulse_token';

/**
 * Opções do cookie de sessão: HttpOnly, SameSite=Lax, Path=/, Secure só em produção.
 * `maxAgeSeconds` é convertido para milissegundos (unidade usada pelo Express).
 */
export function buildAuthCookieOptions(
  _nodeEnv: Env['NODE_ENV'],
  _maxAgeSeconds: number,
): CookieOptions {
  throw new NotImplementedError('buildAuthCookieOptions');
}
