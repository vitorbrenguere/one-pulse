/**
 * Fonte única das variáveis de ambiente de teste.
 * Usada pelo vitest.config.ts (workers) e pelo global-setup (processo principal).
 *
 * - Conexão (host/porta/usuário/senha): vem do backend/.env ou do ambiente (CI).
 * - DB_NAME é SEMPRE forçado para onepulse_test, para nunca tocar o banco de desenvolvimento.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONNECTION_KEYS = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD'] as const;

export const TEST_DB_NAME = 'onepulse_test';

export function loadTestEnvVars(): Record<string, string> {
  const envFile = path.join(BACKEND_ROOT, '.env');
  const fromFile = existsSync(envFile) ? parse(readFileSync(envFile)) : {};

  const connection: Record<string, string> = {};
  for (const key of CONNECTION_KEYS) {
    const value = process.env[key] ?? fromFile[key];
    if (value !== undefined) connection[key] = value;
  }

  return {
    ...connection,
    NODE_ENV: 'test',
    PORT: '0',
    DB_NAME: TEST_DB_NAME,
    JWT_SECRET: 'test-only-jwt-secret-do-not-use-in-production-0123456789',
    JWT_EXPIRES_IN_SECONDS: '28800',
    BCRYPT_ROUNDS: '4',
    CORS_ORIGIN: 'http://localhost:5173',
  };
}
