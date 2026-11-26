import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../services/query-keys';
import type { EvaluationDTO } from '../../../types/api';
import { evaluationsApi, type OpenEvaluationInput, type UpdateEvaluationInput } from '../api';

/**
 * Sem `userId`: COLABORADOR → as próprias; GESTOR → as da equipe (spec 04 §4.2).
 * Com `userId`: as desse usuário (o próprio gestor, como avaliado, ou um liderado).
 */
export function useEvaluations(userId?: number) {
  return useQuery({ queryKey: queryKeys.evaluations(userId), queryFn: () => evaluationsApi.list(userId) });
}

const invalidateEvaluations = (client: QueryClient) =>
  client.invalidateQueries({ queryKey: queryKeys.evaluationsRoot });

function applyEvaluation(client: QueryClient, evaluation: EvaluationDTO): void {
  client.setQueriesData<EvaluationDTO[]>({ queryKey: queryKeys.evaluationsRoot }, (evaluations) =>
    evaluations?.map((current) => (current.id === evaluation.id ? evaluation : current)),
  );
}

export function useOpenEvaluation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: OpenEvaluationInput) => evaluationsApi.open(input),
    onSuccess: () => invalidateEvaluations(queryClient),
  });
}

/** A resposta já vem com a ocultação aplicada pelo servidor (e a revelação, quando conclui). */
export function useUpdateEvaluation(evaluationId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: UpdateEvaluationInput) => evaluationsApi.update(evaluationId, changes),
    onSuccess: (evaluation) => applyEvaluation(queryClient, evaluation),
    onError: () => invalidateEvaluations(queryClient),
  });
}
