import type { Express } from 'express';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import request, { type Response, type Test } from 'supertest';
import { expect } from 'vitest';
import type { GoalCategory, GoalDTO, GoalStatus } from '../../src/modules/pd-goals/pd-goals.types.js';
import type { UserRole } from '../../src/modules/users/user.types.js';
import { FAR_FUTURE } from '../fixtures/pd-goals.fixtures.js';
import { cookieFor } from './tokens.js';

export const GOALS_URL = '/api/v1/pd-goals';
export const NONEXISTENT_ID = 999_999;

/** Spec 03 §2.7: corpos ÚNICOS para "não existe" e "fora do escopo". */
export const GOAL_NOT_FOUND_BODY = { error: { code: 'NOT_FOUND', message: 'Meta não encontrada.' } };
export const USER_NOT_FOUND_BODY = { error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } };

/** Mensagens dos 409 (spec 03 §2.9). */
export const GOAL_LOCKED_MESSAGE = 'Metas concluídas ou canceladas não podem ser alteradas.';
export const GOAL_NOT_DELETABLE_MESSAGE =
  'Apenas metas não iniciadas podem ser excluídas. Para encerrar esta meta, altere o status para CANCELADA.';
export const PAST_TARGET_DATE_MESSAGE = 'Prazo não pode estar no passado.';

/**
 * Timestamps fixos no passado para as metas inseridas pelo helper: assim o teste
 * consegue provar que `updated_at` avançou (a coluna DATETIME tem resolução de 1 segundo).
 */
export const SEEDED_TIMESTAMP_SQL = '2026-01-01 12:00:00';
export const SEEDED_TIMESTAMP_ISO = '2026-01-01T12:00:00.000Z';
const SEEDED_COMPLETED_AT_SQL = '2026-06-01 12:00:00';

const ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Data de hoje em UTC, `AAAA-MM-DD` (spec 03 §2.6). */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysUtc(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Arrange: inserção direta no banco (sem depender da API em teste)
// ---------------------------------------------------------------------------

export interface InsertGoalOptions {
  userId: number;
  createdBy?: number;
  title?: string;
  description?: string | null;
  category?: GoalCategory;
  status?: GoalStatus;
  progress?: number;
  targetDate?: string;
  managerFeedback?: string | null;
}

export interface SeededGoal {
  id: number;
  userId: number;
  createdBy: number;
  title: string;
  description: string | null;
  category: GoalCategory;
  status: GoalStatus;
  progress: number;
  targetDate: string;
  completedAt: string | null;
  managerFeedback: string | null;
  managerFeedbackAt: string | null;
}

/** Progresso coerente com o status (PDI-INV-01/02), salvo se o teste pedir outro. */
const DEFAULT_PROGRESS: Record<GoalStatus, number> = {
  NAO_INICIADA: 0,
  EM_ANDAMENTO: 40,
  CONCLUIDA: 100,
  CANCELADA: 40,
};

export async function insertGoal(pool: Pool, options: InsertGoalOptions): Promise<SeededGoal> {
  const status = options.status ?? 'NAO_INICIADA';
  const goal = {
    userId: options.userId,
    createdBy: options.createdBy ?? options.userId,
    title: options.title ?? 'Meta de teste',
    description: options.description ?? null,
    category: options.category ?? 'TECNICA',
    status,
    progress: options.progress ?? DEFAULT_PROGRESS[status],
    targetDate: options.targetDate ?? FAR_FUTURE,
    completedAt: status === 'CONCLUIDA' ? SEEDED_COMPLETED_AT_SQL : null,
    managerFeedback: options.managerFeedback ?? null,
    managerFeedbackAt: options.managerFeedback ? SEEDED_TIMESTAMP_SQL : null,
  };
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO pd_goals
       (user_id, created_by, title, description, category, status, progress, target_date,
        completed_at, manager_feedback, manager_feedback_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      goal.userId,
      goal.createdBy,
      goal.title,
      goal.description,
      goal.category,
      goal.status,
      goal.progress,
      goal.targetDate,
      goal.completedAt,
      goal.managerFeedback,
      goal.managerFeedbackAt,
      SEEDED_TIMESTAMP_SQL,
      SEEDED_TIMESTAMP_SQL,
    ],
  );
  return {
    ...goal,
    id: result.insertId,
    completedAt: goal.completedAt ? '2026-06-01T12:00:00.000Z' : null,
    managerFeedbackAt: goal.managerFeedbackAt ? SEEDED_TIMESTAMP_ISO : null,
  };
}

export interface GoalRow extends RowDataPacket {
  id: number;
  user_id: number;
  created_by: number;
  title: string;
  description: string | null;
  category: GoalCategory;
  status: GoalStatus;
  progress: number;
  /** Já formatada como `AAAA-MM-DD` pela query (evita conversão de fuso do driver). */
  target_date: string;
  completed_at: Date | null;
  manager_feedback: string | null;
  manager_feedback_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export async function findGoalRowById(pool: Pool, id: number): Promise<GoalRow | undefined> {
  const [rows] = await pool.execute<GoalRow[]>(
    `SELECT id, user_id, created_by, title, description, category, status, progress,
            DATE_FORMAT(target_date, '%Y-%m-%d') AS target_date,
            completed_at, manager_feedback, manager_feedback_at, created_at, updated_at
       FROM pd_goals WHERE id = ?`,
    [id],
  );
  return rows[0];
}

export async function countGoals(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM pd_goals');
  return Number(rows[0]?.['total']);
}

// ---------------------------------------------------------------------------
// Assert
// ---------------------------------------------------------------------------

/**
 * Formato EXATO do GoalDTO (spec 03 §4.0): `toEqual` falha com chave a mais ou a menos.
 * Os defaults descrevem uma meta recém-criada.
 */
export function expectGoalDTO(actual: unknown, expected: Partial<Record<keyof GoalDTO, unknown>> = {}): void {
  expect(actual).toEqual({
    id: expect.any(Number),
    userId: expect.any(Number),
    createdBy: expect.any(Number),
    title: expect.any(String),
    description: null,
    category: expect.stringMatching(/^(TECNICA|COMPORTAMENTAL|CARREIRA)$/),
    status: 'NAO_INICIADA',
    progress: 0,
    targetDate: expect.stringMatching(PLAIN_DATE),
    completedAt: null,
    managerFeedback: null,
    managerFeedbackAt: null,
    createdAt: expect.stringMatching(ISO_8601_UTC),
    updatedAt: expect.stringMatching(ISO_8601_UTC),
    ...expected,
  });
}

/** DTO esperado de uma meta inserida pelo `insertGoal` (sem alterações posteriores). */
export function seededGoalDTO(goal: SeededGoal): GoalDTO {
  return {
    id: goal.id,
    userId: goal.userId,
    createdBy: goal.createdBy,
    title: goal.title,
    description: goal.description,
    category: goal.category,
    status: goal.status,
    progress: goal.progress,
    targetDate: goal.targetDate,
    completedAt: goal.completedAt,
    managerFeedback: goal.managerFeedback,
    managerFeedbackAt: goal.managerFeedbackAt,
    createdAt: SEEDED_TIMESTAMP_ISO,
    updatedAt: SEEDED_TIMESTAMP_ISO,
  };
}

export const ISO_UTC_PATTERN = ISO_8601_UTC;

/** Erro de validação com o campo esperado em `details`. */
export function expectValidationErrorOn(res: Response, field: string): void {
  expect(res.status).toBe(400);
  expect(res.body.error?.code).toBe('VALIDATION_ERROR');
  expect(res.body.error?.details).toContainEqual({ field, message: expect.any(String) });
}

// ---------------------------------------------------------------------------
// Act: cliente HTTP das rotas /pd-goals
// ---------------------------------------------------------------------------

export interface Viewer {
  id: number;
  role: UserRole;
}

export interface GoalsApi {
  create(viewer: Viewer | null, body: unknown): Test;
  list(viewer: Viewer | null, query?: string): Test;
  get(viewer: Viewer | null, id: number | string): Test;
  update(viewer: Viewer | null, id: number | string, body: unknown): Test;
  remove(viewer: Viewer | null, id: number | string): Test;
}

export function goalsApi(app: Express): GoalsApi {
  const auth = (req: Test, viewer: Viewer | null): Test => (viewer ? req.set('Cookie', cookieFor(viewer)) : req);
  // JSON.stringify explícito: permite enviar corpos não-objeto ("texto") para testar o 400.
  const json = (req: Test, body: unknown): Test =>
    req.set('Content-Type', 'application/json').send(JSON.stringify(body));

  return {
    create: (viewer, body) => json(auth(request(app).post(GOALS_URL), viewer), body),
    list: (viewer, query = '') => auth(request(app).get(`${GOALS_URL}${query}`), viewer),
    get: (viewer, id) => auth(request(app).get(`${GOALS_URL}/${id}`), viewer),
    update: (viewer, id, body) => json(auth(request(app).patch(`${GOALS_URL}/${id}`), viewer), body),
    remove: (viewer, id) => auth(request(app).delete(`${GOALS_URL}/${id}`), viewer),
  };
}
