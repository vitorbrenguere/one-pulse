import type { EvaluationStatus, GoalCategory, GoalStatus, UserRole } from '../types/api';

export function roleLabel(role: UserRole): string {
  void role;
  throw new Error('Not implemented: roleLabel');
}

export function goalStatusLabel(status: GoalStatus): string {
  void status;
  throw new Error('Not implemented: goalStatusLabel');
}

export function goalCategoryLabel(category: GoalCategory): string {
  void category;
  throw new Error('Not implemented: goalCategoryLabel');
}

export function evaluationStatusLabel(status: EvaluationStatus): string {
  void status;
  throw new Error('Not implemented: evaluationStatusLabel');
}
