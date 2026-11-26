import type { EvaluationDTO } from '../../types/api';

export type EvaluationViewerRole = 'EVALUATEE' | 'EVALUATOR';
export type EvaluationTone = 'amber' | 'emerald';
export type EvaluationAction = 'FILL_SELF' | 'EVALUATE' | 'VIEW_RESULT' | null;

export interface EvaluationViewState {
  role: EvaluationViewerRole;
  label: string;
  tone: EvaluationTone;
  action: EvaluationAction;
}

export type EvaluationViewInput = Pick<
  EvaluationDTO,
  'userId' | 'managerId' | 'status' | 'selfSubmittedAt' | 'managerSubmittedAt'
>;

/** Estado visual de uma avaliação para o viewer (spec 05 §6.5.1). */
export function getEvaluationViewState(evaluation: EvaluationViewInput, viewerId: number): EvaluationViewState {
  const role: EvaluationViewerRole = evaluation.userId === viewerId ? 'EVALUATEE' : 'EVALUATOR';

  if (evaluation.status === 'CONCLUIDA') {
    return { role, label: 'Concluída · notas reveladas', tone: 'emerald', action: 'VIEW_RESULT' };
  }

  if (role === 'EVALUATEE') {
    if (evaluation.selfSubmittedAt) return { role, label: 'Aguardando gestor', tone: 'amber', action: null };
    const label = evaluation.managerSubmittedAt
      ? 'Autoavaliação pendente · gestor já enviou'
      : 'Autoavaliação pendente';
    return { role, label, tone: 'amber', action: 'FILL_SELF' };
  }

  if (evaluation.managerSubmittedAt) return { role, label: 'Aguardando autoavaliação', tone: 'amber', action: null };
  return { role, label: 'Sua avaliação pendente', tone: 'amber', action: 'EVALUATE' };
}
