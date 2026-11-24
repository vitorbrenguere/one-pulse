import type { UserRecord } from './user.types.js';

export type PolicyViewer = Pick<UserRecord, 'id' | 'role'>;
export type PolicyTarget = Pick<UserRecord, 'id' | 'managerId' | 'isActive'>;

/**
 * Política de visibilidade (spec 02 §2.2), uma função PURA, sem I/O.
 * true ⇔ target ativo E (é o próprio viewer OU viewer é GESTOR e target é liderado direto dele).
 *
 * A checagem de `role` junto com `managerId` é defesa em profundidade (USR-INV-02): mesmo
 * com um dado inconsistente no banco, um COLABORADOR nunca enxerga "liderados".
 */
export function canViewUser(viewer: PolicyViewer, target: PolicyTarget): boolean {
  if (!target.isActive) return false;
  if (target.id === viewer.id) return true;
  return viewer.role === 'GESTOR' && target.managerId === viewer.id;
}
