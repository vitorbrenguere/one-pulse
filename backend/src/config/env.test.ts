import { describe, expect, it } from 'vitest';
import { parseEnv } from './env.js';

const validVars = {
  NODE_ENV: 'development',
  DB_HOST: '127.0.0.1',
  DB_PORT: '3306',
  DB_USER: 'onepulse',
  DB_PASSWORD: 'secret',
  DB_NAME: 'onepulse_db',
  JWT_SECRET: 'x'.repeat(32),
  CORS_ORIGIN: 'http://localhost:5173',
} as const;

describe('parseEnv', () => {
  it('converte tipos e aplica os padrões da spec §3.3', () => {
    expect(parseEnv(validVars)).toEqual({
      ...validVars,
      DB_PORT: 3306,
      PORT: 3333,
      JWT_EXPIRES_IN_SECONDS: 28_800,
      BCRYPT_ROUNDS: 12,
    });
  });

  it('[AUTH-28] falha citando JWT_SECRET quando ele está ausente', () => {
    const { JWT_SECRET: _omitted, ...withoutSecret } = validVars;

    expect(() => parseEnv(withoutSecret)).toThrow(/JWT_SECRET/);
  });

  it('[AUTH-28] falha citando JWT_SECRET quando ele tem menos de 32 caracteres', () => {
    expect(() => parseEnv({ ...validVars, JWT_SECRET: 'x'.repeat(31) })).toThrow(/JWT_SECRET/);
  });

  it('[AUTH-28] aceita JWT_SECRET com exatamente 32 caracteres (fronteira)', () => {
    expect(parseEnv({ ...validVars, JWT_SECRET: 'x'.repeat(32) }).JWT_SECRET).toHaveLength(32);
  });

  it.each([
    ['NODE_ENV inválido', { NODE_ENV: 'staging' }, /NODE_ENV/],
    ['BCRYPT_ROUNDS abaixo de 4', { BCRYPT_ROUNDS: '3' }, /BCRYPT_ROUNDS/],
    ['BCRYPT_ROUNDS acima de 15', { BCRYPT_ROUNDS: '16' }, /BCRYPT_ROUNDS/],
    ['DB_HOST ausente', { DB_HOST: undefined }, /DB_HOST/],
  ])('falha quando %s', (_description, override, expected) => {
    expect(() => parseEnv({ ...validVars, ...override })).toThrow(expected);
  });
});
