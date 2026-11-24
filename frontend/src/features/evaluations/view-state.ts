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
  void evaluation;
  void viewerId;
  throw new Error('Not implemented: getEvaluationViewState');
}
