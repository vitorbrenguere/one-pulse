import { notImplemented } from '../../shared/utils/not-implemented.js';
import type { EvaluationChanges, EvaluationPart, EvaluationState } from './evaluations.types.js';

/**
 * Estado final de uma avaliação após as mudanças de UMA parte (spec 04 §2.4, EVR-02..06).
 * Função PURA: `now` é injetado e `current` nunca é mutado.
 *
 * Lança `409 EVALUATION_LOCKED` (parte enviada ou avaliação CONCLUIDA) e
 * `400 VALIDATION_ERROR` quando o envio não tem os campos obrigatórios (EVR-03).
 *
 * ⚠️ STUB da etapa RED.
 */
export function applyEvaluationChanges(
  _current: EvaluationState,
  _part: EvaluationPart,
  _changes: EvaluationChanges,
  _now: Date,
): EvaluationState {
  return notImplemented('applyEvaluationChanges');
}
