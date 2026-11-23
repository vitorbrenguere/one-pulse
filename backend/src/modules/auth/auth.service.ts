import { NotImplementedError } from '../../shared/errors/not-implemented.error.js';
import type { NewUser, UserDTO, UserRecord, UserRole } from '../users/user.types.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

// ---- Portas (dependências injetadas: permitem testar o service com fakes) ----

export interface UsersRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: number): Promise<UserRecord | null>;
  create(data: NewUser): Promise<UserRecord>;
}

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export interface TokenPayload {
  sub: string;
  role: UserRole;
}

export interface TokenService {
  sign(payload: TokenPayload): string;
  /** Lança erro se o token for inválido, adulterado ou expirado. */
  verify(token: string): TokenPayload;
}

export interface AuthServiceDeps {
  usersRepository: UsersRepository;
  passwordHasher: PasswordHasher;
  tokenService: TokenService;
}

// ---- Contrato do service ----

export interface AuthService {
  /** AUTH-01..04 */
  register(input: RegisterInput): Promise<UserDTO>;
  /** AUTH-07..15 */
  login(input: LoginInput): Promise<{ user: UserDTO; token: string }>;
  /** AUTH-18..23 */
  getCurrentUser(userId: number): Promise<UserDTO>;
}

export function createAuthService(_deps: AuthServiceDeps): AuthService {
  const notImplemented = (method: string) => (): never => {
    throw new NotImplementedError(`AuthService.${method}`);
  };
  return {
    register: notImplemented('register'),
    login: notImplemented('login'),
    getCurrentUser: notImplemented('getCurrentUser'),
  };
}
