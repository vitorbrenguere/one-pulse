import type { Request } from 'express';
import type { UserDTO } from '../../modules/users/user.types.js';
import { unauthenticated } from '../errors/app-error.js';

/**
 * Usuário autenticado da requisição. O requireAuth sempre preenche `req.user`; a checagem
 * é defensiva (fail closed): uma rota que esqueça o requireAuth responde 401, nunca vaza dados.
 */
export function viewerOf(req: Request): UserDTO {
  if (!req.user) throw unauthenticated();
  return req.user;
}
