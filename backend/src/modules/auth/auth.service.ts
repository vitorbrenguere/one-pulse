import { AppError, unauthenticated } from '../../shared/errors/app-error.js';
import { toUserDTO } from '../users/user.mapper.js';
import type { UserDTO, UserRole, UsersRepository as FullUsersRepository } from '../users/user.types.js';
import { DuplicateEmailError } from '../users/users.repository.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

/**
 * Porta que o AuthService realmente usa (Interface Segregation): auth não depende de
 * métodos de equipe ou de perfil, e os fakes de teste implementam só o necessário.
 */
export type UsersRepository = Pick<FullUsersRepository, 'findByEmail' | 'findById' | 'create'>;

// ---- Portas (dependências injetadas: permitem testar o service com fakes) ----

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
  /**
   * Hash usado quando o e-mail não existe (AUTH-15). Em produção, deve ter o MESMO
   * custo do BCRYPT_ROUNDS, para que o tempo de resposta seja indistinguível.
   */
  dummyPasswordHash?: string;
}

// ---- Contrato do service ----

export interface AuthService {
  /** AUTH-01..04 */
  register(input: RegisterInput): Promise<UserDTO>;
  /** AUTH-07..15 */
  login(input: LoginInput): Promise<{ user: UserDTO; token: string }>;
  /** AUTH-18..23: lança UNAUTHENTICATED se o usuário não existir ou estiver inativo. */
  getCurrentUser(userId: number): Promise<UserDTO>;
}

/** Hash bcrypt (custo 12, o padrão de BCRYPT_ROUNDS) de um valor aleatório descartado. */
export const DEFAULT_DUMMY_PASSWORD_HASH = '$2b$12$7/JVn8tHO3OMcrvlZDSeZeKu9uoWXjQ9GIlgX25XDZXLqAdphIAoW';

const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
const emailAlreadyInUse = () => new AppError(409, 'EMAIL_ALREADY_IN_USE', 'E-mail já cadastrado.');

export function createAuthService(deps: AuthServiceDeps): AuthService {
  const { usersRepository, passwordHasher, tokenService } = deps;
  const dummyPasswordHash = deps.dummyPasswordHash ?? DEFAULT_DUMMY_PASSWORD_HASH;

  return {
    async register({ name, email, password }) {
      if (await usersRepository.findByEmail(email)) throw emailAlreadyInUse();

      const passwordHash = await passwordHasher.hash(password);
      try {
        const user = await usersRepository.create({ name, email, passwordHash });
        return toUserDTO(user);
      } catch (error) {
        // Corrida entre dois cadastros simultâneos: o UNIQUE do banco é a última linha de defesa.
        if (error instanceof DuplicateEmailError) throw emailAlreadyInUse();
        throw error;
      }
    },

    async login({ email, password }) {
      const user = await usersRepository.findByEmail(email);

      // SEMPRE executa o bcrypt, mesmo sem usuário, para não revelar pelo tempo de resposta se o e-mail existe.
      const passwordMatches = await passwordHasher.compare(password, user?.passwordHash ?? dummyPasswordHash);

      if (!user || !passwordMatches || !user.isActive) throw invalidCredentials();

      const token = tokenService.sign({ sub: String(user.id), role: user.role });
      return { user: toUserDTO(user), token };
    },

    async getCurrentUser(userId) {
      const user = await usersRepository.findById(userId);
      if (!user || !user.isActive) throw unauthenticated();
      return toUserDTO(user);
    },
  };
}
