import { apiRequest } from '../../services/http';
import type { UserDTO } from '../../types/api';

export const usersApi = {
  team: async (): Promise<UserDTO[]> => (await apiRequest<{ users: UserDTO[] }>('/users/team')).users,
  get: async (id: number): Promise<UserDTO> => (await apiRequest<{ user: UserDTO }>(`/users/${id}`)).user,
};
