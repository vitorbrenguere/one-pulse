import { notImplemented } from '../../shared/utils/not-implemented.js';
import type { PolicyTarget, PolicyViewer } from '../users/users.policy.js';
import type { EvaluationAccess, EvaluationRecord } from './evaluations.types.js';

/**
 * Papel do viewer numa avaliação (spec 04 §2.2): função PURA, sem I/O.
 * `EVALUATOR` exige ter aberto a avaliação (snapshot) E ainda liderar o avaliado (D-07).
 *
 * ⚠️ STUB da etapa RED.
 */
export function getEvaluationAccess(
  _viewer: PolicyViewer,
  _evaluatee: PolicyTarget,
  _evaluation: Pick<EvaluationRecord, 'managerId'>,
): EvaluationAccess {
  return notImplemented('getEvaluationAccess');
}
