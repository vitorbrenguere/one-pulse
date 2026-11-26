import { apiRequest } from '../../services/http';
import type { UserDTO } from '../../types/api';

export interface ProfileChanges {
  name?: string;
  jobTitle?: string | null;
}

export const profileApi = {
  update: async (changes: ProfileChanges): Promise<UserDTO> =>
    (await apiRequest<{ user: UserDTO }>('/users/me', { method: 'PATCH', body: changes })).user,
};
