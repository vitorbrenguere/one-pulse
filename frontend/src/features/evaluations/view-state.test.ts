import { describe, expect, it } from 'vitest';
import type { EvaluationStatus } from '../../types/api';
import { getEvaluationViewState, type EvaluationViewState } from './view-state';

const EVALUATEE_ID = 10;
const EVALUATOR_ID = 1;
const SENT = '2026-12-01T14:00:00.000Z';

type Row = [
  description: string,
  viewerId: number,
  status: EvaluationStatus,
  selfSubmittedAt: string | null,
  managerSubmittedAt: string | null,
  expected: EvaluationViewState,
];

// Matriz completa da spec 05 §6.5.1.
const MATRIX: Row[] = [
  ['avaliado, nada enviado', EVALUATEE_ID, 'ABERTA', null, null,
    { role: 'EVALUATEE', label: 'Autoavaliação pendente', tone: 'amber', action: 'FILL_SELF' }],
  ['avaliado, só o gestor enviou', EVALUATEE_ID, 'ABERTA', null, SENT,
    { role: 'EVALUATEE', label: 'Autoavaliação pendente · gestor já enviou', tone: 'amber', action: 'FILL_SELF' }],
  ['avaliado, só a self enviada', EVALUATEE_ID, 'ABERTA', SENT, null,
    { role: 'EVALUATEE', label: 'Aguardando gestor', tone: 'amber', action: null }],
  ['avaliador, nada enviado', EVALUATOR_ID, 'ABERTA', null, null,
    { role: 'EVALUATOR', label: 'Sua avaliação pendente', tone: 'amber', action: 'EVALUATE' }],
  ['avaliador, só a self enviada', EVALUATOR_ID, 'ABERTA', SENT, null,
    { role: 'EVALUATOR', label: 'Sua avaliação pendente', tone: 'amber', action: 'EVALUATE' }],
  ['avaliador, só ele enviou', EVALUATOR_ID, 'ABERTA', null, SENT,
    { role: 'EVALUATOR', label: 'Aguardando autoavaliação', tone: 'amber', action: null }],
  ['avaliado, concluída', EVALUATEE_ID, 'CONCLUIDA', SENT, SENT,
    { role: 'EVALUATEE', label: 'Concluída · notas reveladas', tone: 'emerald', action: 'VIEW_RESULT' }],
  ['avaliador, concluída', EVALUATOR_ID, 'CONCLUIDA', SENT, SENT,
    { role: 'EVALUATOR', label: 'Concluída · notas reveladas', tone: 'emerald', action: 'VIEW_RESULT' }],
];

describe('getEvaluationViewState (spec 05 §6.5.1)', () => {
  it.each(MATRIX)('[UI-50] %s', (_description, viewerId, status, selfSubmittedAt, managerSubmittedAt, expected) => {
    const state = getEvaluationViewState(
      { userId: EVALUATEE_ID, managerId: EVALUATOR_ID, status, selfSubmittedAt, managerSubmittedAt },
      viewerId,
    );

    expect(state).toEqual(expected);
  });
});
