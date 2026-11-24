import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { GoalCategory, GoalRecord, GoalStatus, GoalUpdate, NewGoal, PdGoalsRepository } from './pd-goals.types.js';

interface GoalRow extends RowDataPacket {
  id: number;
  user_id: number;
  created_by: number;
  title: string;
  description: string | null;
  category: GoalCategory;
  status: GoalStatus;
  progress: number;
  target_date: string;
  completed_at: Date | null;
  manager_feedback: string | null;
  manager_feedback_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * `target_date` sai formatada pelo próprio MySQL: uma coluna DATE é uma data pura, e deixar
 * o driver convertê-la em `Date` (meia-noite em algum fuso) abriria espaço para o bug clássico
 * do "dia anterior" (ADR-06).
 */
const GOAL_COLUMNS = `id, user_id, created_by, title, description, category, status, progress,
  DATE_FORMAT(target_date, '%Y-%m-%d') AS target_date,
  completed_at, manager_feedback, manager_feedback_at, created_at, updated_at`;

/** snake_case (banco) → camelCase (domínio): acontece SOMENTE aqui. */
function toGoalRecord(row: GoalRow): GoalRecord {
  return {
    id: row.id,
    userId: row.user_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    progress: row.progress,
    targetDate: row.target_date,
    completedAt: row.completed_at,
    managerFeedback: row.manager_feedback,
    managerFeedbackAt: row.manager_feedback_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

type SqlValue = string | number | Date | null;

/**
 * Mapa campo do domínio → coluna. É a LISTA FIXA que monta o SET dinâmico: nomes de coluna
 * nunca vêm da entrada do cliente; os valores continuam parametrizados (`?`).
 */
const UPDATE_COLUMNS: { [K in keyof Required<GoalUpdate>]: string } = {
  title: 'title',
  description: 'description',
  category: 'category',
  targetDate: 'target_date',
  status: 'status',
  progress: 'progress',
  completedAt: 'completed_at',
  managerFeedback: 'manager_feedback',
  managerFeedbackAt: 'manager_feedback_at',
};

export function createPdGoalsRepository(pool: Pool): PdGoalsRepository {
  async function findById(id: number): Promise<GoalRecord | null> {
    const [rows] = await pool.execute<GoalRow[]>(`SELECT ${GOAL_COLUMNS} FROM pd_goals WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? toGoalRecord(rows[0]) : null;
  }

  async function create(data: NewGoal): Promise<GoalRecord> {
    // status, progress e os campos de auditoria ficam com os DEFAULTs da tabela (NAO_INICIADA, 0).
    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO pd_goals (user_id, created_by, title, description, category, target_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.userId, data.createdBy, data.title, data.description, data.category, data.targetDate],
    );
    const created = await findById(result.insertId);
    if (!created) throw new Error(`Meta ${result.insertId} não encontrada logo após o INSERT.`);
    return created;
  }

  async function listByUserId(userId: number): Promise<GoalRecord[]> {
    // Coberto pelo índice (user_id, target_date); `id` desempata de forma determinística.
    const [rows] = await pool.execute<GoalRow[]>(
      `SELECT ${GOAL_COLUMNS} FROM pd_goals WHERE user_id = ? ORDER BY target_date ASC, id ASC`,
      [userId],
    );
    return rows.map(toGoalRecord);
  }

  async function update(id: number, changes: GoalUpdate): Promise<GoalRecord | null> {
    const assignments: string[] = [];
    const values: SqlValue[] = [];
    for (const [field, column] of Object.entries(UPDATE_COLUMNS) as Array<[keyof GoalUpdate, string]>) {
      const value = changes[field];
      if (value === undefined) continue;
      assignments.push(`${column} = ?`);
      values.push(value);
    }

    if (assignments.length > 0) {
      await pool.execute(`UPDATE pd_goals SET ${assignments.join(', ')} WHERE id = ?`, [...values, id]);
    }
    return findById(id);
  }

  async function deleteIfNotStarted(id: number): Promise<boolean> {
    // Condição no próprio DELETE (D-10): se outra requisição iniciou a meta entre a leitura
    // do service e este comando, nenhuma linha é afetada e o service responde 409.
    const [result] = await pool.execute<ResultSetHeader>(
      "DELETE FROM pd_goals WHERE id = ? AND status = 'NAO_INICIADA'",
      [id],
    );
    return result.affectedRows > 0;
  }

  return { create, findById, listByUserId, update, deleteIfNotStarted };
}
