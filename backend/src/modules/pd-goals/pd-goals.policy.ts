import { canViewUser, type PolicyTarget, type PolicyViewer } from '../users/users.policy.js';
import type { GoalAccess } from './pd-goals.types.js';

/**
 * Papel do viewer em relação às metas de `owner` (spec 03 §2.2): função PURA, sem I/O.
 *
 * Reutiliza `canViewUser` (spec 02 §2.2) em vez de reimplementar a hierarquia: a regra
 * "quem enxerga quem" fica num lugar só. Se ela mudar, metas e usuários mudam juntos.
 */
export function getGoalAccess(viewer: PolicyViewer, owner: PolicyTarget): GoalAccess {
  if (!canViewUser(viewer, owner)) return 'NONE';
  if (owner.id === viewer.id) return 'OWNER';
  // canViewUser garante: viewer é GESTOR e owner é liderado direto ATIVO.
  return 'MANAGER';
}
