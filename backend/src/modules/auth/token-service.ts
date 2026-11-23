import jwt from 'jsonwebtoken';
import { USER_ROLES, type UserRole } from '../users/user.types.js';
import type { TokenPayload, TokenService } from './auth.service.js';

const ALGORITHM = 'HS256';

function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
}

export function createJwtTokenService(config: { secret: string; expiresInSeconds: number }): TokenService {
  return {
    sign({ sub, role }) {
      return jwt.sign({ role }, config.secret, {
        algorithm: ALGORITHM,
        subject: sub,
        expiresIn: config.expiresInSeconds,
      });
    },

    verify(token) {
      // Fixar `algorithms` impede ataques como `alg: none` e confusão de algoritmo (AUTH-21).
      const decoded = jwt.verify(token, config.secret, { algorithms: [ALGORITHM] });
      if (typeof decoded === 'string' || typeof decoded.sub !== 'string' || !isUserRole(decoded['role'])) {
        throw new Error('Payload de token inválido.');
      }
      const payload: TokenPayload = { sub: decoded.sub, role: decoded['role'] };
      return payload;
    },
  };
}
