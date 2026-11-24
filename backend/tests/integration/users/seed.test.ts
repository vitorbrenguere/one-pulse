import bcrypt from 'bcrypt';
import type { RowDataPacket } from 'mysql2/promise';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { openMigrationConnection } from '../../../database/migrate.js';
import { runSeed, SEED_USERS, type RunSeedOptions, type SeedUser } from '../../../database/seed.js';
import { AUTH_COOKIE_NAME } from '../../../src/modules/auth/auth.cookie.js';
import { countUsers, findUserRowByEmail, findUserRowById, insertUser } from '../../helpers/db.js';
import { testEnv } from '../../helpers/env.js';
import { cookieValue, findSetCookie } from '../../helpers/http.js';
import { useIntegrationContext } from '../../helpers/integration-context.js';
import { authCookie } from '../../helpers/tokens.js';

const SEED_PASSWORD = 'seedSenha123';
const SEED_EMAILS = SEED_USERS.map((user) => user.email);

/** Conexão real com o onepulse_test (multipleStatements, pois o seed aplica migrations). */
const connect: RunSeedOptions['connect'] = () =>
  openMigrationConnection({
    host: testEnv.DB_HOST,
    port: testEnv.DB_PORT,
    user: testEnv.DB_USER,
    password: testEnv.DB_PASSWORD,
    database: testEnv.DB_NAME,
  });

const seed = (users?: readonly SeedUser[]) =>
  runSeed({ nodeEnv: 'test', password: SEED_PASSWORD, bcryptRounds: testEnv.BCRYPT_ROUNDS, connect, ...(users ? { users } : {}) });

interface SeedRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  role: string;
  job_title: string | null;
  is_active: number;
  manager_email: string | null;
}

describe('Seed de desenvolvimento (npm run seed)', () => {
  const ctx = useIntegrationContext();

  async function seedRows(): Promise<SeedRow[]> {
    const [rows] = await ctx.pool.query<SeedRow[]>(
      `SELECT u.id, u.name, u.email, u.role, u.job_title, u.is_active, m.email AS manager_email
         FROM users u LEFT JOIN users m ON m.id = u.manager_id
        WHERE u.email IN (?)
        ORDER BY u.email`,
      [SEED_EMAILS],
    );
    return rows;
  }

  /** Estado esperado: exatamente a tabela da spec 02 §5.2. */
  function expectedRows() {
    return [...SEED_USERS]
      .sort((a, b) => a.email.localeCompare(b.email))
      .map((user) => ({
        id: expect.any(Number),
        name: user.name,
        email: user.email,
        role: user.role,
        job_title: user.jobTitle,
        is_active: 1,
        manager_email: user.managerEmail,
      }));
  }

  it('[USER-25] cria exatamente os 5 usuários da spec, com papéis, cargos e vínculos corretos', async () => {
    const result = await seed();

    expect(await countUsers(ctx.pool)).toBe(5);
    expect(await seedRows()).toEqual(expectedRows());
    expect(result.users).toHaveLength(5);
    expect(result.users.map((user) => user.email).sort()).toEqual([...SEED_EMAILS].sort());
  });

  it('[USER-25] a lista oficial tem 2 GESTORES e 3 COLABORADORES em 2 equipes', () => {
    expect(SEED_USERS.filter((user) => user.role === 'GESTOR')).toHaveLength(2);
    expect(SEED_USERS.filter((user) => user.role === 'COLABORADOR')).toHaveLength(3);
    expect(new Set(SEED_USERS.map((user) => user.managerEmail).filter(Boolean))).toEqual(
      new Set(['gabriela@onepulse.dev', 'gustavo@onepulse.dev']),
    );
  });

  it('[USER-26] executar duas vezes é idempotente: 5 usuários com os MESMOS ids', async () => {
    await seed();
    const firstIds = (await seedRows()).map((row) => row.id);

    await seed();
    const second = await seedRows();

    expect(await countUsers(ctx.pool)).toBe(5);
    expect(second.map((row) => row.id)).toEqual(firstIds);
    expect(second).toEqual(expectedRows());
  });

  it('[USER-27] converge: restaura nome, senha, is_active e manager_id alterados manualmente', async () => {
    await seed();
    const otherHash = await bcrypt.hash('outraSenha999', testEnv.BCRYPT_ROUNDS);
    await ctx.pool.query(
      `UPDATE users SET name = 'Carlos Alterado', password_hash = ?, manager_id = NULL WHERE email = 'carlos@onepulse.dev'`,
      [otherHash],
    );
    await ctx.pool.query(`UPDATE users SET is_active = FALSE, manager_id = NULL WHERE email = 'camila@onepulse.dev'`);

    await seed();

    expect(await seedRows()).toEqual(expectedRows());
    const carlos = await findUserRowByEmail(ctx.pool, 'carlos@onepulse.dev');
    await expect(bcrypt.compare(SEED_PASSWORD, carlos!.password_hash)).resolves.toBe(true);
  });

  it('[USER-28] não altera usuários fora do seed', async () => {
    const outsider = await insertUser(ctx.pool, { name: 'Fora do Seed', email: 'fora@onepulse.dev', jobTitle: 'QA' });
    const before = await findUserRowById(ctx.pool, outsider.id);

    await seed();

    expect(await findUserRowById(ctx.pool, outsider.id)).toEqual(before);
    expect(await countUsers(ctx.pool)).toBe(6);
  });

  it('[USER-29] após o seed: login funciona e cada gestor vê SOMENTE a própria equipe', async () => {
    await seed();

    const login = async (email: string) => {
      const res = await request(ctx.app).post('/api/v1/auth/login').send({ email, password: SEED_PASSWORD });
      expect(res.status).toBe(200);
      return authCookie(cookieValue(findSetCookie(res, AUTH_COOKIE_NAME)!));
    };
    const teamEmails = async (cookie: string) => {
      const res = await request(ctx.app).get('/api/v1/users/team').set('Cookie', cookie);
      expect(res.status).toBe(200);
      return res.body.users.map((user: { email: string }) => user.email);
    };

    await login('carlos@onepulse.dev');
    expect(await teamEmails(await login('gabriela@onepulse.dev'))).toEqual(['camila@onepulse.dev', 'carlos@onepulse.dev']);
    expect(await teamEmails(await login('gustavo@onepulse.dev'))).toEqual(['diego@onepulse.dev']);
  });

  it('[USER-33] falha no meio do seed → rollback: NENHUM usuário da lista fica persistido', async () => {
    const lastIndex = SEED_USERS.length - 1;
    const broken: SeedUser[] = SEED_USERS.map((user, index) =>
      // job_title > 120 passa pelo validateSeedUsers, mas viola o VARCHAR(120) no banco (strict mode)
      index === lastIndex ? { ...user, jobTitle: 'x'.repeat(200) } : user,
    );

    // A causa precisa ser a restrição do banco (não um erro qualquer, que tornaria o teste um falso verde).
    await expect(seed(broken)).rejects.toMatchObject({ code: 'ER_DATA_TOO_LONG' });
    expect(await countUsers(ctx.pool)).toBe(0);

    // A falha não deixa estado quebrado: um seed válido em seguida funciona normalmente.
    await seed();
    expect(await countUsers(ctx.pool)).toBe(5);
  });
});
