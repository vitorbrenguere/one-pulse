import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { NewUser, UserRecord, UserRole, UsersRepository } from './user.types.js';

/** Lançado quando o UNIQUE(email) é violado (ex.: dois cadastros simultâneos). */
export class DuplicateEmailError extends Error {
  constructor() {
    super('E-mail já cadastrado.');
    this.name = 'DuplicateEmailError';
  }
}

interface UserRow extends RowDataPacket {
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

const USER_COLUMNS =
  'id, name, email, password_hash, role, manager_id, job_title, is_active, created_at, updated_at';

/** snake_case (banco) → camelCase (domínio): acontece SOMENTE aqui. */
function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    managerId: row.manager_id,
    jobTitle: row.job_title,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isDuplicateEntry(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ER_DUP_ENTRY';
}

export function createUsersRepository(pool: Pool): UsersRepository {
  async function findById(id: number): Promise<UserRecord | null> {
    const [rows] = await pool.execute<UserRow[]>(`SELECT ${USER_COLUMNS} FROM users WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? toUserRecord(rows[0]) : null;
  }

  async function findByEmail(email: string): Promise<UserRecord | null> {
    const [rows] = await pool.execute<UserRow[]>(`SELECT ${USER_COLUMNS} FROM users WHERE email = ? LIMIT 1`, [
      email,
    ]);
    return rows[0] ? toUserRecord(rows[0]) : null;
  }

  async function create(data: NewUser): Promise<UserRecord> {
    let insertId: number;
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
        [data.name, data.email, data.passwordHash],
      );
      insertId = result.insertId;
    } catch (error) {
      if (isDuplicateEntry(error)) throw new DuplicateEmailError();
      throw error;
    }

    const created = await findById(insertId);
    if (!created) throw new Error(`Usuário ${insertId} não encontrado logo após o INSERT.`);
    return created;
  }

  return { findById, findByEmail, create };
}
