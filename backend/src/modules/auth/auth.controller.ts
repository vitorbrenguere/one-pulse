import type { RequestHandler } from 'express';
import type { Env } from '../../config/env.js';
import { AUTH_COOKIE_NAME, buildAuthCookieOptions, buildClearAuthCookieOptions } from './auth.cookie.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import { unauthenticated, type AuthService } from './auth.service.js';

type BodyHandler<TBody> = RequestHandler<Record<string, string>, unknown, TBody>;

/** Camada HTTP apenas: lê a requisição, delega ao service e monta a resposta. */
export function createAuthController(deps: { authService: AuthService; env: Env }) {
  const { authService, env } = deps;

  const register: BodyHandler<RegisterInput> = async (req, res) => {
    const user = await authService.register(req.body);
    res.status(201).json({ user });
  };

  const login: BodyHandler<LoginInput> = async (req, res) => {
    const { user, token } = await authService.login(req.body);
    res.cookie(AUTH_COOKIE_NAME, token, buildAuthCookieOptions(env.NODE_ENV, env.JWT_EXPIRES_IN_SECONDS));
    res.status(200).json({ user });
  };

  const logout: RequestHandler = (_req, res) => {
    res.clearCookie(AUTH_COOKIE_NAME, buildClearAuthCookieOptions(env.NODE_ENV));
    res.status(204).end();
  };

  const me: RequestHandler = (req, res) => {
    if (!req.user) throw unauthenticated(); // defensivo: requireAuth sempre preenche
    res.status(200).json({ user: req.user });
  };

  return { register, login, logout, me };
}
