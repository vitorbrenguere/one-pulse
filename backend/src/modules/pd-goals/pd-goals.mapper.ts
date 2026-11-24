import type { GoalDTO, GoalRecord } from './pd-goals.types.js';

/** Único caminho de uma meta para fora da API (spec 03 §4.0). Lista de campos explícita. */
export function toGoalDTO(goal: GoalRecord): GoalDTO {
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
    completedAt: goal.completedAt?.toISOString() ?? null,
    managerFeedback: goal.managerFeedback,
    managerFeedbackAt: goal.managerFeedbackAt?.toISOString() ?? null,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}
