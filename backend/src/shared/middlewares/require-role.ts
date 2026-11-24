import type { RequestHandler } from 'express';
import type { UserRole } from '../../modules/users/user.types.js';
import { NotImplementedError } from '../errors/not-implemented.error.js';

/**
 * RBAC por papel (RBAC-02, spec 02 USER-24). Deve ser usado DEPOIS do requireAuth:
 * papel não permitido → 403 FORBIDDEN; `req.user` ausente → 401 UNAUTHENTICATED.
 */
export function requireRole(..._roles: UserRole[]): RequestHandler {
  return () => {
    throw new NotImplementedError('requireRole');
  };
}
