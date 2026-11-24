import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
  DuplicateEvaluationError,
  type EvaluationListFilter,
  type EvaluationRecord,
  type EvaluationStatus,
  type EvaluationsRepository,
  type EvaluationUpdate,
  type NewEvaluation,
} from './evaluations.types.js';

interface EvaluationRow extends RowDataPacket {
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

/** Prefixadas com `e.` porque a listagem da equipe faz JOIN com `users`. */
const EVALUATION_COLUMNS = `e.id, e.user_id, e.manager_id, e.cycle, e.status,
  e.self_score, e.self_comments, e.self_submitted_at,
  e.manager_score, e.manager_feedback, e.manager_submitted_at,
  e.created_at, e.updated_at`;

/** cycle `AAAA-SN` ordena corretamente como texto; `id` desempata de forma determinística. */
const ORDER_BY = 'ORDER BY e.cycle DESC, e.id ASC';

/** snake_case (banco) → camelCase (domínio): acontece SOMENTE aqui. */
function toEvaluationRecord(row: EvaluationRow): EvaluationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    managerId: row.manager_id,
    cycle: row.cycle,
    status: row.status,
    selfScore: row.self_score,
    selfComments: row.self_comments,
    selfSubmittedAt: row.self_submitted_at,
    managerScore: row.manager_score,
    managerFeedback: row.manager_feedback,
    managerSubmittedAt: row.manager_submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isDuplicateEntry(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'ER_DUP_ENTRY';
}

type SqlValue = string | number | Date | null;

/**
 * Mapa campo do domínio → coluna: a LISTA FIXA que monta o SET dinâmico. Nomes de coluna
 * nunca vêm da entrada do cliente; os valores continuam parametrizados (`?`).
 */
const UPDATE_COLUMNS: { [K in keyof Required<EvaluationUpdate>]: string } = {
  status: 'status',
  selfScore: 'self_score',
  selfComments: 'self_comments',
  selfSubmittedAt: 'self_submitted_at',
  managerScore: 'manager_score',
  managerFeedback: 'manager_feedback',
  managerSubmittedAt: 'manager_submitted_at',
};

export function createEvaluationsRepository(pool: Pool): EvaluationsRepository {
  async function findById(id: number): Promise<EvaluationRecord | null> {
    const [rows] = await pool.execute<EvaluationRow[]>(
      `SELECT ${EVALUATION_COLUMNS} FROM evaluations e WHERE e.id = ? LIMIT 1`,
      [id],
    );
    return rows[0] ? toEvaluationRecord(rows[0]) : null;
  }

  async function create(data: NewEvaluation): Promise<EvaluationRecord> {
    let insertId: number;
    try {
      // status e as partes ficam com os DEFAULTs da tabela (ABERTA, tudo NULL): EVR-01.
      const [result] = await pool.execute<ResultSetHeader>(
        'INSERT INTO evaluations (user_id, manager_id, cycle) VALUES (?, ?, ?)',
        [data.userId, data.managerId, data.cycle],
      );
      insertId = result.insertId;
    } catch (error) {
      // O UNIQUE(user_id, cycle) é a garantia final contra dois POSTs simultâneos (EVAL-08).
      if (isDuplicateEntry(error)) throw new DuplicateEvaluationError();
      throw error;
    }

    const created = await findById(insertId);
    if (!created) throw new Error(`Avaliação ${insertId} não encontrada logo após o INSERT.`);
    return created;
  }

  async function listByUserId(userId: number, filter: EvaluationListFilter): Promise<EvaluationRecord[]> {
    const cycleClause = filter.cycle === undefined ? '' : 'AND e.cycle = ?';
    const params: SqlValue[] = filter.cycle === undefined ? [userId] : [userId, filter.cycle];
    const [rows] = await pool.execute<EvaluationRow[]>(
      `SELECT ${EVALUATION_COLUMNS} FROM evaluations e WHERE e.user_id = ? ${cycleClause} ${ORDER_BY}`,
      params,
    );
    return rows.map(toEvaluationRecord);
  }

  async function listByManagerId(managerId: number, filter: EvaluationListFilter): Promise<EvaluationRecord[]> {
    // As duas condições da D-07 no SQL: aberta por ele (e.manager_id) E avaliado hoje é
    // liderado direto ativo dele (u.manager_id / u.is_active).
    const cycleClause = filter.cycle === undefined ? '' : 'AND e.cycle = ?';
    const params: SqlValue[] =
      filter.cycle === undefined ? [managerId, managerId] : [managerId, managerId, filter.cycle];
    const [rows] = await pool.execute<EvaluationRow[]>(
      `SELECT ${EVALUATION_COLUMNS}
         FROM evaluations e
         JOIN users u ON u.id = e.user_id
        WHERE e.manager_id = ? AND u.manager_id = ? AND u.is_active = TRUE ${cycleClause}
        ${ORDER_BY}`,
      params,
    );
    return rows.map(toEvaluationRecord);
  }

  async function update(id: number, changes: EvaluationUpdate): Promise<EvaluationRecord | null> {
    const assignments: string[] = [];
    const values: SqlValue[] = [];
    for (const [field, column] of Object.entries(UPDATE_COLUMNS) as Array<[keyof EvaluationUpdate, string]>) {
      const value = changes[field];
      if (value === undefined) continue;
      assignments.push(`${column} = ?`);
      values.push(value);
    }

    if (assignments.length > 0) {
      await pool.execute(`UPDATE evaluations SET ${assignments.join(', ')} WHERE id = ?`, [...values, id]);
    }
    return findById(id);
  }

  return { create, findById, listByUserId, listByManagerId, update };
}
