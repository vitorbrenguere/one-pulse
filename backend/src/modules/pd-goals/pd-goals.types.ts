/** Tipos do domínio de metas de PDI (spec 03). */

export const GOAL_STATUSES = ['NAO_INICIADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA'] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_CATEGORIES = ['TECNICA', 'COMPORTAMENTAL', 'CARREIRA'] as const;
export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

/** Estados terminais (spec 03 §2.1): travam os campos do dono. */
export const TERMINAL_GOAL_STATUSES: readonly GoalStatus[] = ['CONCLUIDA', 'CANCELADA'];

/** Papel do viewer em relação a uma meta (spec 03 §2.2). */
export type GoalAccess = 'OWNER' | 'MANAGER' | 'NONE';

/** Representação interna, já mapeada de snake_case pelo repository. */
export interface GoalRecord {
  id: number;
  userId: number;
  createdBy: number;
  title: string;
  description: string | null;
  category: GoalCategory;
  status: GoalStatus;
  progress: number;
  /** Data pura `AAAA-MM-DD` (coluna DATE; sem fuso, ADR-06). */
  targetDate: string;
  completedAt: Date | null;
  managerFeedback: string | null;
  managerFeedbackAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Representação pública (spec 03 §4.0). */
export interface GoalDTO {
  id: number;
  userId: number;
  createdBy: number;
  title: string;
  description: string | null;
  category: GoalCategory;
  status: GoalStatus;
  progress: number;
  targetDate: string;
  /** ISO 8601 em UTC */
  completedAt: string | null;
  managerFeedback: string | null;
  /** ISO 8601 em UTC */
  managerFeedbackAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Parte do estado afetada pela máquina de estados e pelas regras PRG (spec 03 §2.4/§2.5). */
export type GoalState = Pick<GoalRecord, 'status' | 'progress' | 'completedAt'>;

/** Campos que só o DONO pode alterar (spec 03 §3.4). Ausente = não alterar. */
export interface OwnerGoalChanges {
  title?: string | undefined;
  description?: string | null | undefined;
  category?: GoalCategory | undefined;
  targetDate?: string | undefined;
  status?: GoalStatus | undefined;
  progress?: number | undefined;
}

export interface NewGoal {
  userId: number;
  createdBy: number;
  title: string;
  description: string | null;
  category: GoalCategory;
  targetDate: string;
}

/** O que o service manda persistir num UPDATE. Ausente = não alterar. */
export interface GoalUpdate {
  title?: string | undefined;
  description?: string | null | undefined;
  category?: GoalCategory | undefined;
  targetDate?: string | undefined;
  status?: GoalStatus | undefined;
  progress?: number | undefined;
  completedAt?: Date | null | undefined;
  managerFeedback?: string | null | undefined;
  managerFeedbackAt?: Date | null | undefined;
}

/** Porta de persistência de metas (implementada em pd-goals.repository.ts). */
export interface PdGoalsRepository {
  create(data: NewGoal): Promise<GoalRecord>;
  findById(id: number): Promise<GoalRecord | null>;
  /** Metas do usuário, ordenadas por target_date ASC, id ASC (spec 03 §4.2). */
  listByUserId(userId: number): Promise<GoalRecord[]>;
  /** Atualiza só os campos presentes e devolve o registro relido (null se o id não existir). */
  update(id: number, changes: GoalUpdate): Promise<GoalRecord | null>;
  /** `DELETE ... WHERE id = ? AND status = 'NAO_INICIADA'`: true se removeu a linha (spec 03 §4.5, D-10). */
  deleteIfNotStarted(id: number): Promise<boolean>;
}
