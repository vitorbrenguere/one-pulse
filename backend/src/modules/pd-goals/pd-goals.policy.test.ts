import { describe, expect, it } from 'vitest';
import type { PolicyTarget, PolicyViewer } from '../users/users.policy.js';
import { getGoalAccess } from './pd-goals.policy.js';
import type { GoalAccess } from './pd-goals.types.js';

/**
 * Spec 03 §2.2. Cenário: G (id 1) gerencia C1 (2), C2 (3) e Ci (4, inativo);
 * G2 (5) gerencia X (6); G tem um gestor próprio, GG (7).
 */
const G: PolicyViewer = { id: 1, role: 'GESTOR' };
const C1: PolicyViewer = { id: 2, role: 'COLABORADOR' };
const G2: PolicyViewer = { id: 5, role: 'GESTOR' };

const owner = (id: number, managerId: number | null, isActive = true): PolicyTarget => ({ id, managerId, isActive });

const SELF_G = owner(1, 7);
const SELF_C1 = owner(2, 1);
const PEER_C2 = owner(3, 1);
const INACTIVE_CI = owner(4, 1, false);
const OTHER_TEAM_X = owner(6, 5);
const MANAGER_OF_G = owner(7, null);

describe('getGoalAccess', () => {
  it.each<readonly [string, PolicyViewer, PolicyTarget, GoalAccess]>([
    ['COLABORADOR → ele mesmo', C1, SELF_C1, 'OWNER'],
    ['COLABORADOR → par da mesma equipe', C1, PEER_C2, 'NONE'],
    ['COLABORADOR → o próprio gestor', C1, owner(1, null), 'NONE'],
    ['COLABORADOR → outro time', C1, OTHER_TEAM_X, 'NONE'],
    ['GESTOR → ele mesmo', G, SELF_G, 'OWNER'],
    ['GESTOR → liderado direto ativo', G, SELF_C1, 'MANAGER'],
    ['GESTOR → outro liderado direto ativo', G, PEER_C2, 'MANAGER'],
    ['GESTOR → liderado direto inativo', G, INACTIVE_CI, 'NONE'],
    ['GESTOR → o próprio gestor', G, MANAGER_OF_G, 'NONE'],
    ['GESTOR → liderado de outro gestor', G, OTHER_TEAM_X, 'NONE'],
    ['GESTOR → outro gestor (par)', G, owner(5, null), 'NONE'],
    ['outro GESTOR → liderado de G', G2, SELF_C1, 'NONE'],
    ['GESTOR inativo → ele mesmo (dado inconsistente)', G, owner(1, 7, false), 'NONE'],
    [
      'defesa em profundidade: COLABORADOR com "liderado" apontando para ele',
      C1,
      owner(99, C1.id),
      'NONE',
    ],
  ])('[GOAL-39] %s → %s', (_description, viewer, target, expected) => {
    expect(getGoalAccess(viewer, target)).toBe(expected);
  });
});
