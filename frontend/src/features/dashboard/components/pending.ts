import type { EvaluationDTO } from '../../../types/api';

/** Liderados com avaliação ABERTA em que a parte do gestor ainda não foi enviada. */
export function pendingUserIds(evaluations: EvaluationDTO[] | undefined, managerId: number): Set<number> {
  return new Set(
    (evaluations ?? [])
      .filter((e) => e.status === 'ABERTA' && e.managerId === managerId && !e.managerSubmittedAt)
      .map((e) => e.userId),
  );
}
