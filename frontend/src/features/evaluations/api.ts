import { apiRequest } from '../../services/http';
import type { EvaluationDTO } from '../../types/api';

export interface OpenEvaluationInput {
  userId: number;
  cycle: string;
}

export interface SelfPartInput {
  selfScore?: number | null;
  selfComments?: string | null;
  submit?: true;
}

export interface ManagerPartInput {
  managerScore?: number | null;
  managerFeedback?: string | null;
  submit?: true;
}

export type UpdateEvaluationInput = SelfPartInput | ManagerPartInput;

export const evaluationsApi = {
  list: async (userId?: number): Promise<EvaluationDTO[]> => {
    const query = userId === undefined ? '' : `?userId=${userId}`;
    return (await apiRequest<{ evaluations: EvaluationDTO[] }>(`/evaluations${query}`)).evaluations;
  },
  open: async (input: OpenEvaluationInput): Promise<EvaluationDTO> =>
    (await apiRequest<{ evaluation: EvaluationDTO }>('/evaluations', { method: 'POST', body: input })).evaluation,
  update: async (id: number, changes: UpdateEvaluationInput): Promise<EvaluationDTO> =>
    (await apiRequest<{ evaluation: EvaluationDTO }>(`/evaluations/${id}`, { method: 'PATCH', body: changes }))
      .evaluation,
};
