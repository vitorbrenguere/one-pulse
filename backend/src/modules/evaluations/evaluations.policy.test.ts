import { describe, expect, it } from 'vitest';
import type { PolicyTarget, PolicyViewer } from '../users/users.policy.js';
import { getEvaluationAccess } from './evaluations.policy.js';
import type { EvaluationAccess } from './evaluations.types.js';

/**
 * Spec 04 §2.2. Cenário: G (id 1) gerencia C1 (2), C2 (3) e Ci (4, inativo);
 * G2 (5) gerencia X (6); GG (7) é o gestor de G.
 */
const G: PolicyViewer = { id: 1, role: 'GESTOR' };
const C1: PolicyViewer = { id: 2, role: 'COLABORADOR' };
const G2: PolicyViewer = { id: 5, role: 'GESTOR' };
const GG: PolicyViewer = { id: 7, role: 'GESTOR' };

const user = (id: number, managerId: number | null, isActive = true): PolicyTarget => ({ id, managerId, isActive });
const openedBy = (managerId: number) => ({ managerId });

describe('getEvaluationAccess', () => {
  it.each<readonly [string, PolicyViewer, PolicyTarget, { managerId: number }, EvaluationAccess]>([
    // COLABORADOR
    ['COLABORADOR → a própria avaliação', C1, user(2, 1), openedBy(1), 'EVALUATEE'],
    ['COLABORADOR → avaliação de par da mesma equipe', C1, user(3, 1), openedBy(1), 'NONE'],
    ['COLABORADOR → avaliação do próprio gestor', C1, user(1, 7), openedBy(7), 'NONE'],
    ['COLABORADOR → avaliação de outro time', C1, user(6, 5), openedBy(5), 'NONE'],
    ['COLABORADOR → a própria, aberta por um ex-gestor', C1, user(2, 1), openedBy(5), 'EVALUATEE'],
    // GESTOR como avaliador
    ['GESTOR → liderado direto ativo, avaliação aberta por ele', G, user(2, 1), openedBy(1), 'EVALUATOR'],
    ['GESTOR → outro liderado direto ativo, aberta por ele', G, user(3, 1), openedBy(1), 'EVALUATOR'],
    ['GESTOR → liderado direto INATIVO, aberta por ele', G, user(4, 1, false), openedBy(1), 'NONE'],
    ['GESTOR → ex-liderado (hoje em outro time), aberta por ele (Q-05)', G, user(2, 5), openedBy(1), 'NONE'],
    ['GESTOR → liderado atual, mas avaliação aberta por outro gestor (D-07)', G, user(2, 1), openedBy(5), 'NONE'],
    ['GESTOR → liderado de outro gestor', G, user(6, 5), openedBy(5), 'NONE'],
    ['outro GESTOR → liderado de G', G2, user(2, 1), openedBy(1), 'NONE'],
    ['GESTOR do gestor → liderado indireto', GG, user(2, 1), openedBy(1), 'NONE'],
    // GESTOR como avaliado
    ['GESTOR → a própria avaliação (aberta pelo gestor dele)', G, user(1, 7), openedBy(7), 'EVALUATEE'],
    ['GESTOR do gestor → avaliação do gestor, aberta por ele', GG, user(1, 7), openedBy(7), 'EVALUATOR'],
    ['GESTOR → avaliação do próprio gestor', G, user(7, null), openedBy(99), 'NONE'],
    // Defesa em profundidade
    ['avaliado inativo (dado inconsistente) → nem ele mesmo acessa', C1, user(2, 1, false), openedBy(1), 'NONE'],
    [
      'COLABORADOR com "liderado" e avaliação apontando para ele (dado inconsistente)',
      C1,
      user(99, 2),
      openedBy(2),
      'NONE',
    ],
  ])('[EVAL-39] %s → %s', (_description, viewer, evaluatee, evaluation, expected) => {
    expect(getEvaluationAccess(viewer, evaluatee, evaluation)).toBe(expected);
  });
});
