import type { EvaluationStatus, GoalCategory, GoalStatus, UserRole } from '../types/api';

const ROLE_LABELS: Record<UserRole, string> = {
  COLABORADOR: 'Colaborador',
  GESTOR: 'Gestor',
};

const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  NAO_INICIADA: 'Não iniciada',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

const GOAL_CATEGORY_LABELS: Record<GoalCategory, string> = {
  TECNICA: 'Técnica',
  COMPORTAMENTAL: 'Comportamental',
  CARREIRA: 'Carreira',
};

const EVALUATION_STATUS_LABELS: Record<EvaluationStatus, string> = {
  ABERTA: 'Em andamento',
  CONCLUIDA: 'Concluída',
};

export const GOAL_STATUSES = Object.keys(GOAL_STATUS_LABELS) as GoalStatus[];
export const GOAL_CATEGORIES = Object.keys(GOAL_CATEGORY_LABELS) as GoalCategory[];

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}

export function goalStatusLabel(status: GoalStatus): string {
  return GOAL_STATUS_LABELS[status];
}

export function goalCategoryLabel(category: GoalCategory): string {
  return GOAL_CATEGORY_LABELS[category];
}

export function evaluationStatusLabel(status: EvaluationStatus): string {
  return EVALUATION_STATUS_LABELS[status];
}

export function isGoalStatus(value: string | null): value is GoalStatus {
  return value !== null && (GOAL_STATUSES as string[]).includes(value);
}
