import bcrypt from 'bcrypt';
import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import type { UserRole } from '../../src/modules/users/user.types.js';
import { testEnv } from './env.js';

export function createTestPool(): Pool {
  return mysql.createPool({
    host: testEnv.DB_HOST,
    port: testEnv.DB_PORT,
    user: testEnv.DB_USER,
    password: testEnv.DB_PASSWORD,
    database: testEnv.DB_NAME,
    timezone: 'Z',
    connectionLimit: 5,
  });
}

/** Limpa os dados entre testes (o schema é criado uma vez no global-setup). */
export async function resetDatabase(pool: Pool): Promise<void> {
  await pool.query('DELETE FROM users');
}

export const DEFAULT_PASSWORD = 'segura123';

export interface SeededUser {
  id: number;
  name: string;
  email: string;
  password: string;
  role: UserRole;
}

/** Insere um usuário direto no banco (Arrange), sem depender da API em teste. */
export async function insertUser(
  pool: Pool,
  overrides: Partial<{ name: string; email: string; password: string; role: UserRole; isActive: boolean }> = {},
): Promise<SeededUser> {
  const user = {
    name: overrides.name ?? 'Ana Souza',
    email: overrides.email ?? 'ana@onepulse.dev',
    password: overrides.password ?? DEFAULT_PASSWORD,
    role: overrides.role ?? 'COLABORADOR',
    isActive: overrides.isActive ?? true,
  };
  const passwordHash = await bcrypt.hash(user.password, testEnv.BCRYPT_ROUNDS);
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, ?)',
    [user.name, user.email, passwordHash, user.role, user.isActive],
  );
  return { id: result.insertId, name: user.name, email: user.email, password: user.password, role: user.role };
}

export interface UserRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: number;
}

export async function findUserRowByEmail(pool: Pool, email: string): Promise<UserRow | undefined> {
  const [rows] = await pool.execute<UserRow[]>('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
}

export async function countUsers(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM users');
  return Number(rows[0]?.['total']);
}
