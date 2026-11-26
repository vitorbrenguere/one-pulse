import { apiRequest } from '../../services/http';
import type { GoalCategory, GoalDTO, GoalStatus } from '../../types/api';

export interface CreateGoalInput {
  title: string;
  category: GoalCategory;
  targetDate: string;
  description?: string;
  userId?: number;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string | null;
  category?: GoalCategory;
  targetDate?: string;
  status?: GoalStatus;
  progress?: number;
  managerFeedback?: string | null;
}

export const goalsApi = {
  list: async (userId?: number): Promise<GoalDTO[]> => {
    const query = userId === undefined ? '' : `?userId=${userId}`;
    return (await apiRequest<{ goals: GoalDTO[] }>(`/pd-goals${query}`)).goals;
  },
  create: async (input: CreateGoalInput): Promise<GoalDTO> =>
    (await apiRequest<{ goal: GoalDTO }>('/pd-goals', { method: 'POST', body: input })).goal,
  update: async (id: number, changes: UpdateGoalInput): Promise<GoalDTO> =>
    (await apiRequest<{ goal: GoalDTO }>(`/pd-goals/${id}`, { method: 'PATCH', body: changes })).goal,
  remove: (id: number): Promise<void> => apiRequest<void>(`/pd-goals/${id}`, { method: 'DELETE' }),
};
