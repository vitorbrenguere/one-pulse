import type { RequestHandler } from 'express';
import type { UserRole } from '../../modules/users/user.types.js';
import { forbidden, unauthenticated } from '../errors/app-error.js';

/**
 * RBAC por papel (RBAC-02, spec 02 USER-24). Deve ser usado DEPOIS do requireAuth:
 * papel não permitido → 403 FORBIDDEN; `req.user` ausente → 401 UNAUTHENTICATED
 * (fail closed: esquecer o requireAuth nunca libera acesso).
 */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) throw unauthenticated();
    if (!roles.includes(req.user.role)) throw forbidden();
    next();
  };
}
