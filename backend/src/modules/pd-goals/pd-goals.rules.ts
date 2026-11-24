import { notImplemented } from '../../shared/utils/not-implemented.js';
import type { GoalState, OwnerGoalChanges } from './pd-goals.types.js';

/**
 * Calcula o estado final de uma meta a partir do estado atual e das mudanças do DONO
 * (spec 03 §2.4 máquina de estados + §2.5 regras PRG-01..08). Função PURA: `now` é injetado.
 *
 * Lança `AppError(409, 'GOAL_LOCKED')` se a meta for terminal e houver qualquer mudança, e
 * `AppError(409, 'INVALID_STATUS_TRANSITION')` para transições proibidas.
 *
 * ⚠️ STUB da etapa RED.
 */
export function applyGoalChanges(_current: GoalState, _changes: OwnerGoalChanges, _now: Date): GoalState {
  return notImplemented('applyGoalChanges');
}
