/**
 * Entrypoint HTTP. O app em si é criado em app.ts (testável sem `listen`).
 * Uso: npm run dev (tsx watch) | npm run build && npm start
 */
import { createApp } from './app.js';
import { createDatabasePool } from './config/database.js';
import { parseEnv, type Env } from './config/env.js';

let env: Env;
try {
  env = parseEnv(process.env);
} catch (error) {
  // Fail fast: sem configuração válida, a aplicação não sobe.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const pool = createDatabasePool(env);

try {
  await pool.query('SELECT 1');
} catch (error) {
  console.error(`[server] Falha ao conectar no MySQL em ${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}.`, error);
  await pool.end();
  process.exit(1);
}

const app = createApp({ env, pool });

const server = app.listen(env.PORT, () => {
  console.log(`[server] OnePulse API ouvindo em http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

/** Graceful shutdown: para de aceitar conexões, termina as requisições em andamento e fecha o pool. */
function shutdown(signal: NodeJS.Signals): void {
  console.log(`[server] ${signal} recebido, encerrando...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
