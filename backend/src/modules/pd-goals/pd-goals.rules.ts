import { AppError } from '../../shared/errors/app-error.js';
import { TERMINAL_GOAL_STATUSES, type GoalState, type GoalStatus, type OwnerGoalChanges } from './pd-goals.types.js';

/** Spec 03 §2.9. */
export const goalLocked = () =>
  new AppError(409, 'GOAL_LOCKED', 'Metas concluídas ou canceladas não podem ser alteradas.');

const invalidTransition = (from: GoalStatus, to: GoalStatus) =>
  new AppError(409, 'INVALID_STATUS_TRANSITION', `Transição de status inválida: de ${from} para ${to}.`);

export function isTerminal(status: GoalStatus): boolean {
  return TERMINAL_GOAL_STATUSES.includes(status);
}

/**
 * Transições proibidas entre estados NÃO terminais (§2.4). Hoje só EM_ANDAMENTO → NAO_INICIADA:
 * "voltar" reabriria o hard delete de uma meta que já teve histórico.
 */
function isForbiddenTransition(from: GoalStatus, to: GoalStatus): boolean {
  return from === 'EM_ANDAMENTO' && to === 'NAO_INICIADA';
}

/**
 * Calcula o estado final de uma meta a partir do estado atual e das mudanças do DONO
 * (spec 03 §2.4 máquina de estados + §2.5 regras PRG-01..08). Função PURA: `now` é injetado
 * e o `current` recebido nunca é mutado.
 *
 * Lança `409 GOAL_LOCKED` se a meta for terminal e `409 INVALID_STATUS_TRANSITION` para
 * transições proibidas. Contradições status × progress já foram barradas no schema (D-07).
 */
export function applyGoalChanges(current: GoalState, changes: OwnerGoalChanges, now: Date): GoalState {
  // PRG-07 / §2.4: terminal trava TODOS os campos do dono, mesmo com valores iguais aos atuais.
  if (isTerminal(current.status)) throw goalLocked();

  let { status, progress } = current;

  if (changes.status !== undefined) {
    if (isForbiddenTransition(current.status, changes.status)) throw invalidTransition(current.status, changes.status);
    status = changes.status;
  }

  if (changes.progress !== undefined) {
    progress = changes.progress;
    // Status explícito vence: as regras implícitas só valem quando o cliente NÃO enviou status.
    if (changes.status === undefined) {
      if (progress === 100) status = 'CONCLUIDA'; // PRG-03
      else if (status === 'NAO_INICIADA' && progress > 0) status = 'EM_ANDAMENTO'; // PRG-02
    }
  }

  // PRG-04: concluir (explícito ou via PRG-03) força 100% e carimba a data.
  // PRG-05: CANCELADA mantém o progress e o completedAt (null, pois a origem não é terminal).
  if (status === 'CONCLUIDA') return { status, progress: 100, completedAt: now };
  return { status, progress, completedAt: current.completedAt };
}
