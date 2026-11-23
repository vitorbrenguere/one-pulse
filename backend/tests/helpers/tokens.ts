import jwt from 'jsonwebtoken';
import { AUTH_COOKIE_NAME } from '../../src/modules/auth/auth.cookie.js';
import type { UserRole } from '../../src/modules/users/user.types.js';
import { testEnv } from './env.js';

/**
 * Gera JWTs direto com a lib (sem passar pelo /login), para que os testes do /me
 * não dependam da implementação do login. O contrato do token está na spec §2.1.
 */
interface Claims {
  sub: string;
  role: UserRole;
}

export function signTestToken(claims: Claims, options: { secret?: string; expiresInSeconds?: number } = {}): string {
  return jwt.sign({ role: claims.role }, options.secret ?? testEnv.JWT_SECRET, {
    algorithm: 'HS256',
    subject: claims.sub,
    expiresIn: options.expiresInSeconds ?? testEnv.JWT_EXPIRES_IN_SECONDS,
  });
}

/** Token com assinatura válida, porém expirado há 1 minuto. */
export function signExpiredToken(claims: Claims): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    { role: claims.role, iat: now - testEnv.JWT_EXPIRES_IN_SECONDS - 60, exp: now - 60 },
    testEnv.JWT_SECRET,
    { algorithm: 'HS256', subject: claims.sub },
  );
}

/** Token sem assinatura (`alg: none`), um ataque clássico contra validações ingênuas de JWT. */
export function buildUnsignedToken(claims: Claims): string {
  const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ ...claims, iat: now, exp: now + 3600 })}.`;
}

/** Troca o último caractere da assinatura, deixando-a inválida. */
export function tamperSignature(token: string): string {
  const last = token.at(-1);
  return token.slice(0, -1) + (last === 'A' ? 'B' : 'A');
}

export function authCookie(token: string): string {
  return `${AUTH_COOKIE_NAME}=${token}`;
}
