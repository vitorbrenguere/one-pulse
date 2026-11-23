import type { Express } from 'express';
import type { Pool } from 'mysql2/promise';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { createApp } from '../../src/app.js';
import { createTestPool, resetDatabase } from './db.js';
import { testEnv } from './env.js';

export interface IntegrationContext {
  app: Express;
  pool: Pool;
}

/**
 * Registra os hooks padrão de um arquivo de integração:
 * pool real do onepulse_test, app novo por arquivo e banco limpo antes de cada teste.
 */
export function useIntegrationContext(): IntegrationContext {
  const ctx = {} as IntegrationContext;

  beforeAll(() => {
    ctx.pool = createTestPool();
    ctx.app = createApp({ env: testEnv, pool: ctx.pool });
  });

  beforeEach(async () => {
    await resetDatabase(ctx.pool);
  });

  afterAll(async () => {
    await ctx.pool.end();
  });

  return ctx;
}
