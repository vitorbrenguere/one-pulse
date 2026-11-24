import { describe, expect, it } from 'vitest';
import { canViewUser, type PolicyTarget, type PolicyViewer } from './users.policy.js';

/**
 * Matriz da spec 02 §2.2. Ids: G=1 (gestor), C1=10 e C2=11 (liderados de G),
 * G2=2 (outro gestor), X=20 (liderado de G2), N=30 (liderado de C1, indireto para G).
 */
const G: PolicyViewer = { id: 1, role: 'GESTOR' };
const C1: PolicyViewer = { id: 10, role: 'COLABORADOR' };

const target = (id: number, managerId: number | null, isActive = true): PolicyTarget => ({ id, managerId, isActive });

const MATRIX: ReadonlyArray<readonly [string, PolicyViewer, PolicyTarget, boolean]> = [
  // COLABORADOR
  ['COLABORADOR → ele mesmo', C1, target(10, 1), true],
  ['COLABORADOR → par da mesma equipe', C1, target(11, 1), false],
  ['COLABORADOR → o próprio gestor', C1, target(1, null), false],
  ['COLABORADOR → outro time', C1, target(20, 2), false],
  ['COLABORADOR com "liderado" (dado inconsistente): defesa em profundidade', C1, target(30, 10), false],
  // GESTOR
  ['GESTOR → ele mesmo', G, target(1, null), true],
  ['GESTOR → liderado direto ativo', G, target(10, 1), true],
  ['GESTOR → liderado direto inativo', G, target(12, 1, false), false],
  ['GESTOR → liderado indireto', G, target(30, 10), false],
  ['GESTOR → outro gestor', G, target(2, null), false],
  ['GESTOR → o próprio gestor dele', { id: 1, role: 'GESTOR' }, target(99, null), false],
  ['GESTOR → liderado de outro time', G, target(20, 2), false],
  // Alvo inativo, mesmo sendo o próprio viewer
  ['ele mesmo, porém inativo', C1, target(10, 1, false), false],
];

describe('canViewUser', () => {
  it.each(MATRIX)('[USER-17] %s → %s', (_description, viewer, targetUser, expected) => {
    expect(canViewUser(viewer, targetUser)).toBe(expected);
  });
});
