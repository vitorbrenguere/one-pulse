import { notImplemented } from '../../shared/utils/not-implemented.js';
import type { PolicyTarget, PolicyViewer } from '../users/users.policy.js';
import type { GoalAccess } from './pd-goals.types.js';

/**
 * Papel do viewer em relação às metas de `owner` (spec 03 §2.2): função PURA, sem I/O.
 * Reutiliza `canViewUser` (spec 02 §2.2).
 *
 * ⚠️ STUB da etapa RED.
 */
export function getGoalAccess(_viewer: PolicyViewer, _owner: PolicyTarget): GoalAccess {
  return notImplemented('getGoalAccess');
}
