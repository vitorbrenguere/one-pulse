import { AppError } from '../../shared/errors/app-error.js';
import { toUserDTO } from './user.mapper.js';
import type { ProfileChanges, UserDTO, UsersRepository } from './user.types.js';
import { canViewUser, type PolicyViewer } from './users.policy.js';

export type UsersServiceRepository = Pick<UsersRepository, 'findById' | 'findTeamByManagerId' | 'updateProfile'>;

export interface UsersService {
  /** Equipe do gestor. O controle por papel (GESTOR) é feito na rota, com requireRole. */
  listTeam(managerId: number): Promise<UserDTO[]>;
  /** RBAC-03: fora do escopo e inexistente geram o MESMO 404. */
  getVisibleUser(viewer: PolicyViewer, targetId: number): Promise<UserDTO>;
  updateProfile(userId: number, changes: ProfileChanges): Promise<UserDTO>;
}

/** Spec 02 §2.4: corpo único para "não existe" e "não é seu". */
const userNotFound = () => new AppError(404, 'NOT_FOUND', 'Usuário não encontrado.');

export function createUsersService(deps: { usersRepository: UsersServiceRepository }): UsersService {
  const { usersRepository } = deps;

  return {
    async listTeam(managerId) {
      const team = await usersRepository.findTeamByManagerId(managerId);
      return team.map(toUserDTO);
    },

    async getVisibleUser(viewer, targetId) {
      const target = await usersRepository.findById(targetId);
      // Mesmo caminho de erro para os dois casos: o cliente não distingue "não existe" de "não é seu".
      if (!target || !canViewUser(viewer, target)) throw userNotFound();
      return toUserDTO(target);
    },

    async updateProfile(userId, changes) {
      const updated = await usersRepository.updateProfile(userId, changes);
      if (!updated) throw userNotFound();
      return toUserDTO(updated);
    },
  };
}
