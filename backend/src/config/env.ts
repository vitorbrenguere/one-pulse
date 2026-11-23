import { NotImplementedError } from '../shared/errors/not-implemented.error.js';

/** Configuração validada da aplicação (spec 01-auth §3.3). */
export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN_SECONDS: number;
  BCRYPT_ROUNDS: number;
  CORS_ORIGIN: string;
}

/**
 * Valida e normaliza variáveis de ambiente (fail fast no boot).
 * Deve lançar um erro cuja mensagem cite a(s) variável(is) inválida(s).
 */
export function parseEnv(_source: Record<string, string | undefined>): Env {
  throw new NotImplementedError('parseEnv');
}
