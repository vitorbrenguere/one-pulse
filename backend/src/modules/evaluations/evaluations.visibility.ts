import { notImplemented } from '../../shared/utils/not-implemented.js';
import type { EvaluationAccess, EvaluationDTO, EvaluationRecord } from './evaluations.types.js';

/**
 * Único caminho de uma avaliação para fora da API, já com a regra anti-viés (spec 04 §2.5):
 * campos ocultos saem como `null`, sem mudar o formato do DTO. Função PURA.
 *
 * ⚠️ STUB da etapa RED.
 */
export function toEvaluationDTO(
  _evaluation: EvaluationRecord,
  _access: Exclude<EvaluationAccess, 'NONE'>,
): EvaluationDTO {
  return notImplemented('toEvaluationDTO');
}
