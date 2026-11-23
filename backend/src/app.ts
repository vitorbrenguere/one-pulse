import express, { type Express } from 'express';
import type { Pool } from 'mysql2/promise';
import type { Env } from './config/env.js';

export interface AppDependencies {
  env: Env;
  pool: Pool;
}

/**
 * Cria o app Express SEM chamar `listen`, para que os testes usem o Supertest
 * e injetem dependências (ex.: um pool quebrado para o AUTH-27).
 *
 * Fase RED: nenhuma rota registrada, então toda requisição responde 404.
 */
export function createApp(_deps: AppDependencies): Express {
  return express();
}
