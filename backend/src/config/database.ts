import mysql, { type Pool } from 'mysql2/promise';
import type { Env } from './env.js';

export function createDatabasePool(env: Env): Pool {
  return mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    // O banco guarda DATETIME em UTC (docker-compose: --default-time-zone=+00:00) e o driver lê como UTC.
    timezone: 'Z',
    connectionLimit: 10,
    waitForConnections: true,
  });
}
