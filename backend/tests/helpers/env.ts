import type { Env } from '../../src/config/env.js';

/**
 * Env tipado para os testes, montado diretamente do process.env (preenchido pelo vitest.config).
 * Não usa parseEnv(), para que os testes de integração não dependam da implementação dele
 * (o parseEnv tem testes próprios: AUTH-28).
 */
function required(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') throw new Error(`[tests] process.env.${key} ausente`);
  return value;
}

export const testEnv: Env = {
  NODE_ENV: 'test',
  PORT: 0,
  DB_HOST: required('DB_HOST'),
  DB_PORT: Number(required('DB_PORT')),
  DB_USER: required('DB_USER'),
  DB_PASSWORD: required('DB_PASSWORD'),
  DB_NAME: required('DB_NAME'),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN_SECONDS: Number(required('JWT_EXPIRES_IN_SECONDS')),
  BCRYPT_ROUNDS: Number(required('BCRYPT_ROUNDS')),
  CORS_ORIGIN: required('CORS_ORIGIN'),
};
