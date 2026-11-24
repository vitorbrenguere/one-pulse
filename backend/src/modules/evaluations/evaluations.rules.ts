import { AppError, type ValidationDetail } from '../../shared/errors/app-error.js';
import type { EvaluationChanges, EvaluationPart, EvaluationState } from './evaluations.types.js';

/** Spec 04 §2.8. */
export const evaluationLocked = () =>
  new AppError(409, 'EVALUATION_LOCKED', 'Esta parte da avaliação já foi enviada e não pode ser alterada.');

const MISSING_SCORE = 'Informe a nota antes de enviar.';
const MISSING_FEEDBACK = 'Informe o feedback antes de enviar.';

function isPartLocked(current: EvaluationState, part: EvaluationPart): boolean {
  if (current.status === 'CONCLUIDA') return true; // EVR-06
  return (part === 'SELF' ? current.selfSubmittedAt : current.managerSubmittedAt) !== null; // EVR-05
}

/** EVR-03 / Q-07: o que falta, no estado FINAL, para a parte poder ser enviada. */
function missingForSubmit(next: EvaluationState, part: EvaluationPart): ValidationDetail[] {
  const missing: ValidationDetail[] = [];
  if (part === 'SELF') {
    if (next.selfScore === null) missing.push({ field: 'selfScore', message: MISSING_SCORE });
    return missing; // selfComments é opcional
  }
  if (next.managerScore === null) missing.push({ field: 'managerScore', message: MISSING_SCORE });
  if (next.managerFeedback === null) missing.push({ field: 'managerFeedback', message: MISSING_FEEDBACK });
  return missing;
}

/**
 * Estado final de uma avaliação após as mudanças de UMA parte (spec 04 §2.4, EVR-02..06).
 * Função PURA: `now` é injetado e `current` nunca é mutado.
 *
 * Só os campos da `part` são aplicados: o service já recusou com 403 qualquer campo da outra
 * parte, e ignorá-los aqui é defesa em profundidade (uma parte nunca escreve na outra).
 */
export function applyEvaluationChanges(
  current: EvaluationState,
  part: EvaluationPart,
  changes: EvaluationChanges,
  now: Date,
): EvaluationState {
  // 409 antes do 400: mesmo um envio incompleto numa parte travada é "travada" (§2.7).
  if (isPartLocked(current, part)) throw evaluationLocked();

  const next: EvaluationState = { ...current };
  if (part === 'SELF') {
    if (changes.selfScore !== undefined) next.selfScore = changes.selfScore;
    if (changes.selfComments !== undefined) next.selfComments = changes.selfComments;
  } else {
    if (changes.managerScore !== undefined) next.managerScore = changes.managerScore;
    if (changes.managerFeedback !== undefined) next.managerFeedback = changes.managerFeedback;
  }

  if (changes.submit) {
    const missing = missingForSubmit(next, part);
    if (missing.length > 0) throw new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos.', missing);

    if (part === 'SELF') next.selfSubmittedAt = now;
    else next.managerSubmittedAt = now;

    // EVR-04 / EVAL-INV-03: a segunda parte enviada conclui a avaliação na mesma escrita.
    if (next.selfSubmittedAt !== null && next.managerSubmittedAt !== null) next.status = 'CONCLUIDA';
  }

  return next;
}
