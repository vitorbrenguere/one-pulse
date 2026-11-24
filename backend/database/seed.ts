/**
 * Seed de desenvolvimento (spec 02 §5): 2 equipes, com 2 gestores e 3 liderados.
 * Uso: npm run seed   (lê backend/.env; recusa rodar com NODE_ENV=production)
 */
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcrypt';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { parseEnv } from '../src/config/env.js';
import { registerSchema } from '../src/modules/auth/auth.schemas.js';
import type { UserRole } from '../src/modules/users/user.types.js';
import { openMigrationConnection, runMigrations } from './migrate.js';

export interface SeedUser {
  name: string;
  email: string;
  role: UserRole;
  jobTitle: string | null;
  /** E-mail do gestor dentro da própria lista (null = sem gestor). */
  managerEmail: string | null;
}

/** Dados oficiais (spec 02 §5.2). */
export const SEED_USERS: readonly SeedUser[] = [
  { name: 'Gabriela Martins', email: 'gabriela@onepulse.dev', role: 'GESTOR', jobTitle: 'Engineering Manager', managerEmail: null },
  { name: 'Carlos Lima', email: 'carlos@onepulse.dev', role: 'COLABORADOR', jobTitle: 'Desenvolvedor Júnior', managerEmail: 'gabriela@onepulse.dev' },
  { name: 'Camila Rocha', email: 'camila@onepulse.dev', role: 'COLABORADOR', jobTitle: 'Desenvolvedora Pleno', managerEmail: 'gabriela@onepulse.dev' },
  { name: 'Gustavo Alves', email: 'gustavo@onepulse.dev', role: 'GESTOR', jobTitle: 'Product Manager', managerEmail: null },
  { name: 'Diego Ferreira', email: 'diego@onepulse.dev', role: 'COLABORADOR', jobTitle: 'Analista de Produto', managerEmail: 'gustavo@onepulse.dev' },
];

export const DEFAULT_SEED_PASSWORD = 'onepulse123';

export interface RunSeedOptions {
  nodeEnv: string;
  password: string;
  bcryptRounds: number;
  connect: () => Promise<Connection>;
  users?: readonly SeedUser[];
}

export interface SeedResult {
  users: Array<{ id: number; email: string; role: UserRole }>;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * Valida a lista ANTES de qualquer escrita (spec 02 §5.4). A mensagem de erro traz o
 * identificador da regra e o e-mail envolvido, para o erro ser acionável.
 */
export function validateSeedUsers(users: readonly SeedUser[], password: string): void {
  // Reutiliza a MESMA regra do cadastro: uma única fonte da verdade para a política de senha.
  if (!registerSchema.shape.password.safeParse(password).success) {
    throw new Error('[SEED-WEAK-PASSWORD] A senha do seed não respeita a política de cadastro (spec 01 §3.1).');
  }

  const byEmail = new Map<string, SeedUser>();
  for (const user of users) {
    const email = normalizeEmail(user.email);
    if (byEmail.has(email)) throw new Error(`[SEED-DUP-EMAIL] E-mail duplicado na lista do seed: ${email}`);
    byEmail.set(email, user);
  }

  for (const user of users) {
    if (user.managerEmail === null) continue;
    const email = normalizeEmail(user.email);
    const managerEmail = normalizeEmail(user.managerEmail);

    if (managerEmail === email) {
      throw new Error(`[USR-INV-01] ${email} não pode ser gestor(a) de si mesmo(a).`);
    }
    const manager = byEmail.get(managerEmail);
    if (!manager) {
      throw new Error(`[SEED-UNKNOWN-MANAGER] O gestor ${managerEmail} de ${email} não está na lista do seed.`);
    }
    if (manager.role !== 'GESTOR') {
      throw new Error(`[USR-INV-02] O gestor de ${email} (${managerEmail}) precisa ter o papel GESTOR.`);
    }
  }
}

interface IdRow extends RowDataPacket {
  id: number;
  email: string;
  role: UserRole;
}

/**
 * Upsert transacional e convergente (spec 02 §5.3):
 * 1. upsert de cada usuário por e-mail (o id é preservado), restaurando nome, cargo, papel, senha e is_active;
 * 2. resolução dos vínculos manager_id por e-mail (independe da ordem da lista).
 * Qualquer falha dispara o rollback: tudo ou nada (USER-33).
 */
export async function runSeed(options: RunSeedOptions): Promise<SeedResult> {
  const users = options.users ?? SEED_USERS;

  // Guardas que rodam ANTES de qualquer I/O (USER-30, §5.4)
  if (options.nodeEnv === 'production') {
    throw new Error('[seed] Recusado: o seed de desenvolvimento não roda em produção (NODE_ENV=production).');
  }
  validateSeedUsers(users, options.password);

  const connection = await options.connect();
  try {
    await runMigrations(connection); // DDL faz commit implícito no MySQL: precisa ficar FORA da transação

    await connection.beginTransaction();
    try {
      for (const user of users) {
        const passwordHash = await bcrypt.hash(options.password, options.bcryptRounds);
        await connection.execute(
          `INSERT INTO users (name, email, password_hash, role, job_title, is_active, manager_id)
           VALUES (?, ?, ?, ?, ?, TRUE, NULL) AS incoming
           ON DUPLICATE KEY UPDATE
             name = incoming.name,
             password_hash = incoming.password_hash,
             role = incoming.role,
             job_title = incoming.job_title,
             is_active = TRUE,
             manager_id = NULL`,
          [user.name, normalizeEmail(user.email), passwordHash, user.role, user.jobTitle],
        );
      }

      const emails = users.map((user) => normalizeEmail(user.email));
      const [rows] = await connection.query<IdRow[]>('SELECT id, email, role FROM users WHERE email IN (?)', [emails]);
      const idByEmail = new Map(rows.map((row) => [row.email, row.id]));
      const idOf = (email: string): number => {
        const id = idByEmail.get(normalizeEmail(email));
        if (id === undefined) throw new Error(`[seed] Usuário ${email} não encontrado após o upsert.`);
        return id;
      };

      for (const user of users) {
        if (user.managerEmail === null) continue;
        await connection.execute('UPDATE users SET manager_id = ? WHERE id = ?', [idOf(user.managerEmail), idOf(user.email)]);
      }

      await connection.commit();
      return { users: rows.map(({ id, email, role }) => ({ id, email, role })) };
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } finally {
    await connection.end();
  }
}

// ---- Execução via CLI (npm run seed) ----
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const env = parseEnv(process.env);
    const password = process.env['SEED_USER_PASSWORD'] || DEFAULT_SEED_PASSWORD;

    const result = await runSeed({
      nodeEnv: env.NODE_ENV,
      password,
      bcryptRounds: env.BCRYPT_ROUNDS,
      connect: () =>
        openMigrationConnection({
          host: env.DB_HOST,
          port: env.DB_PORT,
          user: env.DB_USER,
          password: env.DB_PASSWORD,
          database: env.DB_NAME,
        }),
    });

    const managerOf = new Map(SEED_USERS.map((user) => [user.email, user.managerEmail ?? '—']));
    console.log(`[seed] ${env.DB_NAME}: ${result.users.length} usuários garantidos.`);
    console.table(result.users.map((user) => ({ ...user, gestor: managerOf.get(user.email) })));
    console.log(`[seed] Senha de todos os usuários do seed: ${password}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
