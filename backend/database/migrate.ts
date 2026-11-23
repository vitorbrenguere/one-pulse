/**
 * Migrator minimalista: aplica, em ordem, os arquivos `migrations/NNN_*.sql` ainda não
 * registrados na tabela `schema_migrations`. Cada migration roda uma única vez por banco.
 *
 * Uso: npm run db:migrate   (lê DB_* do backend/.env)
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mysql, { type Connection, type RowDataPacket } from 'mysql2/promise';

export const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export interface DbConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/** Abre a conexão com `multipleStatements` (necessário apenas para executar arquivos .sql). */
export function openMigrationConnection(config: DbConnectionConfig): Promise<Connection> {
  return mysql.createConnection({ ...config, multipleStatements: true, timezone: 'Z' });
}

export async function runMigrations(
  connection: Connection,
  dir: string = MIGRATIONS_DIR,
): Promise<string[]> {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);

  const [rows] = await connection.query<RowDataPacket[]>('SELECT version FROM schema_migrations');
  const applied = new Set(rows.map((row) => String(row['version'])));

  const files = (await readdir(dir)).filter((file) => /^\d{3}_.+\.sql$/.test(file)).sort();
  const newlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(dir, file), 'utf8');
    // DDL no MySQL faz commit implícito; por isso cada migration deve ser pequena e idempotente na intenção.
    await connection.query(sql);
    await connection.query('INSERT INTO schema_migrations (version) VALUES (?)', [file]);
    newlyApplied.push(file);
  }

  return newlyApplied;
}

/** Remove TODAS as tabelas do banco conectado. Uso exclusivo do setup de testes. */
export async function dropAllTables(connection: Connection): Promise<void> {
  const [rows] = await connection.query<RowDataPacket[]>(
    'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()',
  );
  if (rows.length === 0) return;
  const names = rows.map((row) => mysql.escapeId(String(row['name']))).join(', ');
  await connection.query(`SET FOREIGN_KEY_CHECKS = 0; DROP TABLE ${names}; SET FOREIGN_KEY_CHECKS = 1;`);
}

function readDbConfigFromEnv(env: NodeJS.ProcessEnv): DbConnectionConfig {
  const required = (key: string): string => {
    const value = env[key];
    if (!value) throw new Error(`Variável de ambiente ausente: ${key}`);
    return value;
  };
  return {
    host: required('DB_HOST'),
    port: Number(required('DB_PORT')),
    user: required('DB_USER'),
    password: required('DB_PASSWORD'),
    database: required('DB_NAME'),
  };
}

// Execução via CLI (npm run db:migrate)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = readDbConfigFromEnv(process.env);
  const connection = await openMigrationConnection(config);
  try {
    const applied = await runMigrations(connection);
    console.log(
      applied.length > 0
        ? `[migrate] ${config.database}: aplicadas → ${applied.join(', ')}`
        : `[migrate] ${config.database}: nada a aplicar.`,
    );
  } finally {
    await connection.end();
  }
}
