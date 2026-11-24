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
  // Tabelas filhas primeiro: pd_goals.created_by e evaluations.manager_id são ON DELETE RESTRICT
  // e bloqueariam o DELETE FROM users.
  await pool.query('DELETE FROM evaluations');
  await pool.query('DELETE FROM pd_goals');
  // Zera os vínculos antes de apagar, para não depender da ordem das FKs auto-referentes.
  await pool.query('UPDATE users SET manager_id = NULL');
  await pool.query('DELETE FROM users');
}

export const DEFAULT_PASSWORD = 'segura123';

export interface SeededUser {
  id: number;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  managerId: number | null;
  jobTitle: string | null;
}

export interface InsertUserOverrides {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  isActive?: boolean;
  managerId?: number | null;
  jobTitle?: string | null;
}

/** Insere um usuário direto no banco (Arrange), sem depender da API em teste. */
export async function insertUser(pool: Pool, overrides: InsertUserOverrides = {}): Promise<SeededUser> {
  const user = {
    name: overrides.name ?? 'Ana Souza',
    email: overrides.email ?? 'ana@onepulse.dev',
    password: overrides.password ?? DEFAULT_PASSWORD,
    role: overrides.role ?? 'COLABORADOR',
    isActive: overrides.isActive ?? true,
    managerId: overrides.managerId ?? null,
    jobTitle: overrides.jobTitle ?? null,
  };
  const passwordHash = await bcrypt.hash(user.password, testEnv.BCRYPT_ROUNDS);
  const [result] = await pool.execute<ResultSetHeader>(
    'INSERT INTO users (name, email, password_hash, role, is_active, manager_id, job_title) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [user.name, user.email, passwordHash, user.role, user.isActive, user.managerId, user.jobTitle],
  );
  return {
    id: result.insertId,
    name: user.name,
    email: user.email,
    password: user.password,
    role: user.role,
    managerId: user.managerId,
    jobTitle: user.jobTitle,
  };
}

/**
 * Hierarquia padrão dos testes da spec 02 (§6, notação):
 * G → {C1, C2, Ci(inativo)} · G2 → {X} · C1 → {N} (indireto para G; dado inconsistente de propósito)
 */
export interface Hierarchy {
  G: SeededUser;
  C1: SeededUser;
  C2: SeededUser;
  Ci: SeededUser;
  G2: SeededUser;
  X: SeededUser;
  N: SeededUser;
}

export async function insertHierarchy(pool: Pool): Promise<Hierarchy> {
  const G = await insertUser(pool, { name: 'Gabriela Martins', email: 'g@onepulse.dev', role: 'GESTOR', jobTitle: 'Engineering Manager' });
  const G2 = await insertUser(pool, { name: 'Gustavo Alves', email: 'g2@onepulse.dev', role: 'GESTOR' });
  const C1 = await insertUser(pool, { name: 'Carlos Lima', email: 'c1@onepulse.dev', managerId: G.id, jobTitle: 'Desenvolvedor Júnior' });
  const C2 = await insertUser(pool, { name: 'Camila Rocha', email: 'c2@onepulse.dev', managerId: G.id, jobTitle: 'Desenvolvedora Pleno' });
  const Ci = await insertUser(pool, { name: 'Ivo Inativo', email: 'ci@onepulse.dev', managerId: G.id, isActive: false });
  const X = await insertUser(pool, { name: 'Xavier Souza', email: 'x@onepulse.dev', managerId: G2.id });
  const N = await insertUser(pool, { name: 'Nina Indireta', email: 'n@onepulse.dev', managerId: C1.id });
  return { G, C1, C2, Ci, G2, X, N };
}

export interface UserRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  manager_id: number | null;
  job_title: string | null;
  is_active: number;
  created_at: Date;
  updated_at: Date;
}

export async function findUserRowByEmail(pool: Pool, email: string): Promise<UserRow | undefined> {
  const [rows] = await pool.execute<UserRow[]>('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
}

export async function findUserRowById(pool: Pool, id: number): Promise<UserRow | undefined> {
  const [rows] = await pool.execute<UserRow[]>('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0];
}

export async function countUsers(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM users');
  return Number(rows[0]?.['total']);
}
