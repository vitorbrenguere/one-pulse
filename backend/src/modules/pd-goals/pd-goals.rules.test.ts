import { describe, expect, it } from 'vitest';
import { applyGoalChanges } from './pd-goals.rules.js';
import { GOAL_STATUSES, type GoalState, type GoalStatus, type OwnerGoalChanges } from './pd-goals.types.js';

const NOW = new Date('2026-11-24T15:30:00.000Z');
const EARLIER = new Date('2026-06-01T12:00:00.000Z');

/** Estado atual coerente com cada status (PDI-INV-01/02). */
const STATE: Record<GoalStatus, GoalState> = {
  NAO_INICIADA: { status: 'NAO_INICIADA', progress: 0, completedAt: null },
  EM_ANDAMENTO: { status: 'EM_ANDAMENTO', progress: 40, completedAt: null },
  CONCLUIDA: { status: 'CONCLUIDA', progress: 100, completedAt: EARLIER },
  CANCELADA: { status: 'CANCELADA', progress: 40, completedAt: null },
};

type Expected = { ok: GoalStatus } | { error: 'INVALID_STATUS_TRANSITION' | 'GOAL_LOCKED' };

/** Spec 03 §2.4: a tabela de transições, linha a linha (16 combinações). */
const TRANSITIONS: Record<GoalStatus, Record<GoalStatus, Expected>> = {
  NAO_INICIADA: {
    NAO_INICIADA: { ok: 'NAO_INICIADA' },
    EM_ANDAMENTO: { ok: 'EM_ANDAMENTO' },
    CONCLUIDA: { ok: 'CONCLUIDA' },
    CANCELADA: { ok: 'CANCELADA' },
  },
  EM_ANDAMENTO: {
    NAO_INICIADA: { error: 'INVALID_STATUS_TRANSITION' },
    EM_ANDAMENTO: { ok: 'EM_ANDAMENTO' },
    CONCLUIDA: { ok: 'CONCLUIDA' },
    CANCELADA: { ok: 'CANCELADA' },
  },
  CONCLUIDA: {
    NAO_INICIADA: { error: 'GOAL_LOCKED' },
    EM_ANDAMENTO: { error: 'GOAL_LOCKED' },
    CONCLUIDA: { error: 'GOAL_LOCKED' },
    CANCELADA: { error: 'GOAL_LOCKED' },
  },
  CANCELADA: {
    NAO_INICIADA: { error: 'GOAL_LOCKED' },
    EM_ANDAMENTO: { error: 'GOAL_LOCKED' },
    CONCLUIDA: { error: 'GOAL_LOCKED' },
    CANCELADA: { error: 'GOAL_LOCKED' },
  },
};

const transitionCases = GOAL_STATUSES.flatMap((from) =>
  GOAL_STATUSES.map((to) => [from, to, TRANSITIONS[from][to]] as const),
);

function expectAppError(fn: () => unknown, code: string): void {
  let thrown: unknown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  expect(thrown, `esperava AppError ${code}`).toMatchObject({ statusCode: 409, code, message: expect.any(String) });
}

describe('applyGoalChanges: máquina de estados (spec 03 §2.4)', () => {
  it.each(transitionCases)('[GOAL-26] %s → %s', (from, to, expected) => {
    if ('ok' in expected) {
      expect(applyGoalChanges(STATE[from], { status: to }, NOW).status).toBe(expected.ok);
    } else {
      expectAppError(() => applyGoalChanges(STATE[from], { status: to }, NOW), expected.error);
    }
  });

  it('[GOAL-26] a mensagem do INVALID_STATUS_TRANSITION cita a origem e o destino', () => {
    expect(() => applyGoalChanges(STATE.EM_ANDAMENTO, { status: 'NAO_INICIADA' }, NOW)).toThrow(
      'Transição de status inválida: de EM_ANDAMENTO para NAO_INICIADA.',
    );
  });

  it.each<readonly [GoalStatus, OwnerGoalChanges]>([
    ['CONCLUIDA', { title: 'Novo título' }],
    ['CONCLUIDA', { description: null }],
    ['CONCLUIDA', { progress: 100 }],
    ['CANCELADA', { targetDate: '2099-12-31' }],
    ['CANCELADA', { category: 'CARREIRA' }],
    ['CANCELADA', { progress: 50 }],
  ])('[GOAL-26] meta %s trava qualquer campo do dono: %o → GOAL_LOCKED', (status, changes) => {
    expectAppError(() => applyGoalChanges(STATE[status], changes, NOW), 'GOAL_LOCKED');
  });
});

describe('applyGoalChanges: regras de progresso (spec 03 §2.5)', () => {
  it.each<readonly [string, GoalState, OwnerGoalChanges, GoalState]>([
    // PRG-02 (PDI-INV-02)
    ['PRG-02: progress > 0 em NAO_INICIADA inicia a meta', STATE.NAO_INICIADA, { progress: 30 }, { status: 'EM_ANDAMENTO', progress: 30, completedAt: null }],
    ['PRG-02: progress 0 em NAO_INICIADA não muda nada', STATE.NAO_INICIADA, { progress: 0 }, STATE.NAO_INICIADA],
    // PRG-03 (PDI-INV-01)
    ['PRG-03: progress 100 em EM_ANDAMENTO conclui', STATE.EM_ANDAMENTO, { progress: 100 }, { status: 'CONCLUIDA', progress: 100, completedAt: NOW }],
    ['PRG-03: progress 100 em NAO_INICIADA conclui direto', STATE.NAO_INICIADA, { progress: 100 }, { status: 'CONCLUIDA', progress: 100, completedAt: NOW }],
    // PRG-04 (PDI-INV-01, Q-05)
    ['PRG-04: status CONCLUIDA força progress 100 e completedAt', STATE.EM_ANDAMENTO, { status: 'CONCLUIDA' }, { status: 'CONCLUIDA', progress: 100, completedAt: NOW }],
    ['PRG-04: NAO_INICIADA → CONCLUIDA direto (Q-05)', STATE.NAO_INICIADA, { status: 'CONCLUIDA' }, { status: 'CONCLUIDA', progress: 100, completedAt: NOW }],
    ['PRG-04: CONCLUIDA com progress 100 explícito', STATE.EM_ANDAMENTO, { status: 'CONCLUIDA', progress: 100 }, { status: 'CONCLUIDA', progress: 100, completedAt: NOW }],
    // PRG-05
    ['PRG-05: cancelar EM_ANDAMENTO congela o progresso', STATE.EM_ANDAMENTO, { status: 'CANCELADA' }, { status: 'CANCELADA', progress: 40, completedAt: null }],
    ['PRG-05: cancelar NAO_INICIADA mantém 0', STATE.NAO_INICIADA, { status: 'CANCELADA' }, { status: 'CANCELADA', progress: 0, completedAt: null }],
    // PRG-06
    ['PRG-06: progresso pode descer em EM_ANDAMENTO', { status: 'EM_ANDAMENTO', progress: 60, completedAt: null }, { progress: 20 }, { status: 'EM_ANDAMENTO', progress: 20, completedAt: null }],
    ['PRG-06: progresso pode voltar a 0 sem voltar a NAO_INICIADA', { status: 'EM_ANDAMENTO', progress: 60, completedAt: null }, { progress: 0 }, { status: 'EM_ANDAMENTO', progress: 0, completedAt: null }],
    ['PRG-06: progresso 99 continua EM_ANDAMENTO', STATE.EM_ANDAMENTO, { progress: 99 }, { status: 'EM_ANDAMENTO', progress: 99, completedAt: null }],
    // PRG-08
    ['PRG-08: iniciar sem progress mantém 0', STATE.NAO_INICIADA, { status: 'EM_ANDAMENTO' }, { status: 'EM_ANDAMENTO', progress: 0, completedAt: null }],
    ['PRG-08: iniciar com progress explícito', STATE.NAO_INICIADA, { status: 'EM_ANDAMENTO', progress: 50 }, { status: 'EM_ANDAMENTO', progress: 50, completedAt: null }],
    // Só conteúdo: o estado não muda
    ['só conteúdo em EM_ANDAMENTO não altera o estado', STATE.EM_ANDAMENTO, { title: 'Novo título', targetDate: '2099-01-01' }, STATE.EM_ANDAMENTO],
    ['só conteúdo em NAO_INICIADA não altera o estado', STATE.NAO_INICIADA, { description: 'Detalhe' }, STATE.NAO_INICIADA],
  ])('[GOAL-27] %s', (_description, current, changes, expected) => {
    expect(applyGoalChanges(current, changes, NOW)).toEqual(expected);
  });

  it('[GOAL-27] PRG-07: progress em meta terminal → GOAL_LOCKED', () => {
    expectAppError(() => applyGoalChanges(STATE.CANCELADA, { progress: 10 }, NOW), 'GOAL_LOCKED');
    expectAppError(() => applyGoalChanges(STATE.CONCLUIDA, { progress: 10 }, NOW), 'GOAL_LOCKED');
  });

  it('[GOAL-27] não muta o estado recebido (função pura)', () => {
    const current: GoalState = { status: 'NAO_INICIADA', progress: 0, completedAt: null };
    const snapshot = structuredClone(current);

    applyGoalChanges(current, { progress: 100 }, NOW);

    expect(current).toEqual(snapshot);
  });
});
