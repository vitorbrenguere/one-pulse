import type { Express } from 'express';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import request, { type Response, type Test } from 'supertest';
import { expect } from 'vitest';
import type { EvaluationDTO, EvaluationStatus } from '../../src/modules/evaluations/evaluations.types.js';
import { VALID_CYCLE } from '../fixtures/evaluations.fixtures.js';
import { insertUser, type SeededUser } from './db.js';
import type { Viewer } from './goals.js';
import { cookieFor } from './tokens.js';

export const EVALUATIONS_URL = '/api/v1/evaluations';
export const NONEXISTENT_ID = 999_999;

/** Spec 04 §2.6: corpos ÚNICOS para "não existe" e "fora do escopo". */
export const EVALUATION_NOT_FOUND_BODY = { error: { code: 'NOT_FOUND', message: 'Avaliação não encontrada.' } };
export const USER_NOT_FOUND_BODY = { error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' } };

/** Mensagens da spec 04 §2.4 (EVR-03) e §2.8. */
export const ALREADY_EXISTS_BODY = {
  error: { code: 'EVALUATION_ALREADY_EXISTS', message: 'Já existe uma avaliação deste colaborador para o ciclo informado.' },
};
export const LOCKED_BODY = {
  error: { code: 'EVALUATION_LOCKED', message: 'Esta parte da avaliação já foi enviada e não pode ser alterada.' },
};
export const MISSING_SCORE_MESSAGE = 'Informe a nota antes de enviar.';
export const MISSING_FEEDBACK_MESSAGE = 'Informe o feedback antes de enviar.';

/**
 * Timestamps fixos no passado: o teste consegue provar que `updated_at` avançou e
 * comparar os `*SubmittedAt` semeados (DATETIME tem resolução de 1 segundo).
 */
export const SEEDED_TIMESTAMP_SQL = '2026-01-01 12:00:00';
export const SEEDED_TIMESTAMP_ISO = '2026-01-01T12:00:00.000Z';
const SELF_SUBMITTED_SQL = '2026-06-01 12:00:00';
const SELF_SUBMITTED_ISO = '2026-06-01T12:00:00.000Z';
const MANAGER_SUBMITTED_SQL = '2026-06-02 12:00:00';
const MANAGER_SUBMITTED_ISO = '2026-06-02T12:00:00.000Z';

export const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// ---------------------------------------------------------------------------
// Arrange
// ---------------------------------------------------------------------------

/** Cria GG, gestor do usuário informado (para os casos em que um GESTOR é avaliado). */
export async function insertManagerOf(pool: Pool, user: SeededUser): Promise<SeededUser> {
  const manager = await insertUser(pool, { name: 'Glória Diretora', email: 'gg@onepulse.dev', role: 'GESTOR' });
  await pool.execute('UPDATE users SET manager_id = ? WHERE id = ?', [manager.id, user.id]);
  return manager;
}

export interface InsertEvaluationOptions {
  userId: number;
  managerId: number;
  cycle?: string;
  selfScore?: number | null;
  selfComments?: string | null;
  selfSubmitted?: boolean;
  managerScore?: number | null;
  managerFeedback?: string | null;
  managerSubmitted?: boolean;
}

/** Avaliação semeada, já no formato COMPLETO do DTO (sem nenhuma ocultação). */
export type SeededEvaluation = EvaluationDTO;

/**
 * Insere direto no banco. O `status` é derivado das partes enviadas (EVAL-INV-03), e as
 * partes enviadas recebem a nota/feedback padrão se o teste não informar (EVAL-INV-04).
 */
export async function insertEvaluation(pool: Pool, options: InsertEvaluationOptions): Promise<SeededEvaluation> {
  const selfSubmitted = options.selfSubmitted ?? false;
  const managerSubmitted = options.managerSubmitted ?? false;
  const status: EvaluationStatus = selfSubmitted && managerSubmitted ? 'CONCLUIDA' : 'ABERTA';
  const row = {
    cycle: options.cycle ?? VALID_CYCLE,
    selfScore: options.selfScore !== undefined ? options.selfScore : selfSubmitted ? 4 : null,
    selfComments: options.selfComments ?? null,
    managerScore: options.managerScore !== undefined ? options.managerScore : managerSubmitted ? 3 : null,
    managerFeedback:
      options.managerFeedback !== undefined ? options.managerFeedback : managerSubmitted ? 'Feedback do gestor.' : null,
  };
  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO evaluations
       (user_id, manager_id, cycle, status, self_score, self_comments, self_submitted_at,
        manager_score, manager_feedback, manager_submitted_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      options.userId,
      options.managerId,
      row.cycle,
      status,
      row.selfScore,
      row.selfComments,
      selfSubmitted ? SELF_SUBMITTED_SQL : null,
      row.managerScore,
      row.managerFeedback,
      managerSubmitted ? MANAGER_SUBMITTED_SQL : null,
      SEEDED_TIMESTAMP_SQL,
      SEEDED_TIMESTAMP_SQL,
    ],
  );
  return {
    id: result.insertId,
    userId: options.userId,
    managerId: options.managerId,
    cycle: row.cycle,
    status,
    selfScore: row.selfScore,
    selfComments: row.selfComments,
    selfSubmittedAt: selfSubmitted ? SELF_SUBMITTED_ISO : null,
    managerScore: row.managerScore,
    managerFeedback: row.managerFeedback,
    managerSubmittedAt: managerSubmitted ? MANAGER_SUBMITTED_ISO : null,
    createdAt: SEEDED_TIMESTAMP_ISO,
    updatedAt: SEEDED_TIMESTAMP_ISO,
  };
}

/** O DTO como o AVALIADO o vê enquanto a avaliação está ABERTA: parte do gestor oculta. */
export function withManagerPartHidden(dto: EvaluationDTO): EvaluationDTO {
  return { ...dto, managerScore: null, managerFeedback: null };
}

/** O DTO como o GESTOR o vê enquanto a autoavaliação não foi enviada: parte self oculta. */
export function withSelfPartHidden(dto: EvaluationDTO): EvaluationDTO {
  return { ...dto, selfScore: null, selfComments: null };
}

export interface EvaluationRow extends RowDataPacket {
  id: number;
  user_id: number;
  manager_id: number;
  cycle: string;
  status: EvaluationStatus;
  self_score: number | null;
  self_comments: string | null;
  self_submitted_at: Date | null;
  manager_score: number | null;
  manager_feedback: string | null;
  manager_submitted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export async function findEvaluationRowById(pool: Pool, id: number): Promise<EvaluationRow | undefined> {
  const [rows] = await pool.execute<EvaluationRow[]>('SELECT * FROM evaluations WHERE id = ?', [id]);
  return rows[0];
}

export async function countEvaluations(pool: Pool): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM evaluations');
  return Number(rows[0]?.['total']);
}

// ---------------------------------------------------------------------------
// Assert
// ---------------------------------------------------------------------------

/**
 * Formato EXATO do EvaluationDTO (spec 04 §4.0): `toEqual` falha com chave a mais ou a menos.
 * Os defaults descrevem uma avaliação recém-aberta.
 */
export function expectEvaluationDTO(actual: unknown, expected: Partial<Record<keyof EvaluationDTO, unknown>> = {}): void {
  expect(actual).toEqual({
    id: expect.any(Number),
    userId: expect.any(Number),
    managerId: expect.any(Number),
    cycle: expect.stringMatching(/^20\d{2}-S[12]$/),
    status: 'ABERTA',
    selfScore: null,
    selfComments: null,
    selfSubmittedAt: null,
    managerScore: null,
    managerFeedback: null,
    managerSubmittedAt: null,
    createdAt: expect.stringMatching(ISO_UTC_PATTERN),
    updatedAt: expect.stringMatching(ISO_UTC_PATTERN),
    ...expected,
  });
}

/** Erro de validação com o campo esperado em `details`. */
export function expectValidationErrorOn(res: Response, field: string): void {
  expect(res.status).toBe(400);
  expect(res.body.error?.code).toBe('VALIDATION_ERROR');
  expect(res.body.error?.details).toContainEqual({ field, message: expect.any(String) });
}

/** Erro de envio incompleto (EVR-03): exatamente os campos faltantes, com as mensagens da spec. */
export function expectMissingForSubmit(res: Response, fields: readonly string[]): void {
  const messages: Record<string, string> = {
    selfScore: MISSING_SCORE_MESSAGE,
    managerScore: MISSING_SCORE_MESSAGE,
    managerFeedback: MISSING_FEEDBACK_MESSAGE,
  };
  expect(res.status).toBe(400);
  expect(res.body.error?.code).toBe('VALIDATION_ERROR');
  expect(res.body.error?.details).toHaveLength(fields.length);
  for (const field of fields) {
    expect(res.body.error?.details).toContainEqual({ field, message: messages[field] });
  }
}

// ---------------------------------------------------------------------------
// Act: cliente HTTP das rotas /evaluations
// ---------------------------------------------------------------------------

export interface EvaluationsApi {
  create(viewer: Viewer | null, body: unknown): Test;
  list(viewer: Viewer | null, query?: string): Test;
  get(viewer: Viewer | null, id: number | string): Test;
  update(viewer: Viewer | null, id: number | string, body: unknown): Test;
}

export function evaluationsApi(app: Express): EvaluationsApi {
  const auth = (req: Test, viewer: Viewer | null): Test => (viewer ? req.set('Cookie', cookieFor(viewer)) : req);
  // JSON.stringify explícito: permite enviar corpos não-objeto ("texto") para testar o 400.
  const json = (req: Test, body: unknown): Test =>
    req.set('Content-Type', 'application/json').send(JSON.stringify(body));

  return {
    create: (viewer, body) => json(auth(request(app).post(EVALUATIONS_URL), viewer), body),
    list: (viewer, query = '') => auth(request(app).get(`${EVALUATIONS_URL}${query}`), viewer),
    get: (viewer, id) => auth(request(app).get(`${EVALUATIONS_URL}/${id}`), viewer),
    update: (viewer, id, body) => json(auth(request(app).patch(`${EVALUATIONS_URL}/${id}`), viewer), body),
  };
}
