import type { UserDTO } from '../modules/users/user.types.js';

declare global {
  namespace Express {
    interface Request {
      /** Preenchido pelo middleware requireAuth: usuário autenticado e ativo. */
      user?: UserDTO;
    }
  }
}

export {};
