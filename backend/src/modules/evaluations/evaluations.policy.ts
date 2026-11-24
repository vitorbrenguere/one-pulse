import { canViewUser, type PolicyTarget, type PolicyViewer } from '../users/users.policy.js';
import type { EvaluationAccess, EvaluationRecord } from './evaluations.types.js';

/**
 * Papel do viewer numa avaliação (spec 04 §2.2): função PURA, sem I/O.
 *
 * `EVALUATOR` exige DUAS condições (D-07):
 * - ter aberto a avaliação (`managerId`, snapshot gravado na abertura, EVAL-INV-02); e
 * - ainda liderar o avaliado ativo HOJE (`canViewUser`, a mesma regra das specs 02/03).
 * Assim o gestor antigo perde o acesso ao sair da liderança, e um gestor novo não assume
 * uma avaliação que não abriu (limitação aceita na Q-05).
 */
export function getEvaluationAccess(
  viewer: PolicyViewer,
  evaluatee: PolicyTarget,
  evaluation: Pick<EvaluationRecord, 'managerId'>,
): EvaluationAccess {
  if (evaluatee.id === viewer.id) return evaluatee.isActive ? 'EVALUATEE' : 'NONE';
  if (evaluation.managerId === viewer.id && canViewUser(viewer, evaluatee)) return 'EVALUATOR';
  return 'NONE';
}
