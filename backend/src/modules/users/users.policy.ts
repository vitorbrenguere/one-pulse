import { NotImplementedError } from '../../shared/errors/not-implemented.error.js';
import type { UserRecord } from './user.types.js';

export type PolicyViewer = Pick<UserRecord, 'id' | 'role'>;
export type PolicyTarget = Pick<UserRecord, 'id' | 'managerId' | 'isActive'>;

/**
 * Política de visibilidade (spec 02 §2.2), uma função PURA, sem I/O.
 * true ⇔ target ativo E (é o próprio viewer OU viewer é GESTOR e target é liderado direto dele).
 */
export function canViewUser(_viewer: PolicyViewer, _target: PolicyTarget): boolean {
  throw new NotImplementedError('canViewUser');
}
