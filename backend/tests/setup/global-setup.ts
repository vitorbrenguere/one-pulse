/**
 * Roda UMA vez antes da suíte de integração: recria o schema do onepulse_test
 * do zero, aplicando todas as migrations. Assim o banco de teste reflete exatamente as migrations.
 */
import { dropAllTables, openMigrationConnection, runMigrations } from '../../database/migrate.js';
import { loadTestEnvVars, TEST_DB_NAME } from './test-env-vars.js';

export default async function setup(): Promise<void> {
  const vars = loadTestEnvVars();

  // Trava de segurança: este setup APAGA tabelas. Nunca pode apontar para outro banco.
  if (vars['DB_NAME'] !== TEST_DB_NAME) {
    throw new Error(`[global-setup] Recusado: DB_NAME="${vars['DB_NAME']}" (esperado "${TEST_DB_NAME}").`);
  }

  const missing = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD'].filter((key) => !vars[key]);
  if (missing.length > 0) {
    throw new Error(`[global-setup] Variáveis ausentes: ${missing.join(', ')}. Crie o backend/.env a partir do .env.example.`);
  }

  let connection;
  try {
    connection = await openMigrationConnection({
      host: vars['DB_HOST']!,
      port: Number(vars['DB_PORT']),
      user: vars['DB_USER']!,
      password: vars['DB_PASSWORD']!,
      database: TEST_DB_NAME,
    });
  } catch (error) {
    throw new Error(
      `[global-setup] Não foi possível conectar ao MySQL de teste. O container está rodando? (docker compose up -d)\n${String(error)}`,
    );
  }

  try {
    await dropAllTables(connection);
    await runMigrations(connection);
  } finally {
    await connection.end();
  }
}
