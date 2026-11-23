import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRecord } from '../users/user.types.js';
import {
  createAuthService,
  type AuthService,
  type PasswordHasher,
  type TokenService,
  type UsersRepository,
} from './auth.service.js';

const BCRYPT_HASH_FORMAT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

const existingUser: UserRecord = {
  id: 1,
  name: 'Ana Souza',
  email: 'ana@onepulse.dev',
  passwordHash: '$2b$04$abcdefghijklmnopqrstuuJ4R5sW8m1d9hXbq3QK0yZ1tZqYp8m9a',
  role: 'COLABORADOR',
  managerId: null,
  jobTitle: null,
  isActive: true,
  createdAt: new Date('2026-11-22T12:00:00.000Z'),
  updatedAt: new Date('2026-11-22T12:00:00.000Z'),
};

describe('AuthService.login (proteção contra timing attack)', () => {
  let usersRepository: { [K in keyof UsersRepository]: ReturnType<typeof vi.fn<UsersRepository[K]>> };
  let passwordHasher: { [K in keyof PasswordHasher]: ReturnType<typeof vi.fn<PasswordHasher[K]>> };
  let tokenService: { [K in keyof TokenService]: ReturnType<typeof vi.fn<TokenService[K]>> };
  let service: AuthService;

  beforeEach(() => {
    usersRepository = {
      findByEmail: vi.fn<UsersRepository['findByEmail']>(async () => null),
      findById: vi.fn<UsersRepository['findById']>(async () => null),
      create: vi.fn<UsersRepository['create']>(),
    };
    passwordHasher = {
      hash: vi.fn<PasswordHasher['hash']>(),
      compare: vi.fn<PasswordHasher['compare']>(async () => false),
    };
    tokenService = {
      sign: vi.fn<TokenService['sign']>(() => 'signed.jwt.token'),
      verify: vi.fn<TokenService['verify']>(),
    };
    service = createAuthService({ usersRepository, passwordHasher, tokenService });
  });

  it('[AUTH-15] com e-mail inexistente, ainda executa bcrypt.compare contra um hash fictício', async () => {
    await expect(service.login({ email: 'ghost@onepulse.dev', password: 'segura123' })).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });

    expect(passwordHasher.compare).toHaveBeenCalledTimes(1);
    expect(passwordHasher.compare).toHaveBeenCalledWith('segura123', expect.stringMatching(BCRYPT_HASH_FORMAT));
    expect(tokenService.sign).not.toHaveBeenCalled();
  });

  it('[AUTH-15] com senha errada, compara contra o hash real do usuário (mesmo custo de CPU)', async () => {
    usersRepository.findByEmail.mockResolvedValue(existingUser);

    await expect(service.login({ email: existingUser.email, password: 'errada123' })).rejects.toMatchObject({
      statusCode: 401,
      code: 'INVALID_CREDENTIALS',
    });

    expect(passwordHasher.compare).toHaveBeenCalledTimes(1);
    expect(passwordHasher.compare).toHaveBeenCalledWith('errada123', existingUser.passwordHash);
    expect(tokenService.sign).not.toHaveBeenCalled();
  });
});
