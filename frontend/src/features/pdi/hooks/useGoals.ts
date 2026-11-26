import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../services/query-keys';
import type { GoalDTO } from '../../../types/api';
import { goalsApi, type CreateGoalInput, type UpdateGoalInput } from '../api';

/** Sem `userId`: as próprias metas. Com `userId`: as do liderado (spec 03 §4.2). */
export function useGoals(userId?: number) {
  return useQuery({ queryKey: queryKeys.goals(userId), queryFn: () => goalsApi.list(userId) });
}

const invalidateGoals = (client: QueryClient) => client.invalidateQueries({ queryKey: queryKeys.goalsRoot });

/** Aplica a meta devolvida pela API em todas as listas em cache (spec 05 §3.4, D-08). */
function applyGoal(client: QueryClient, goal: GoalDTO): void {
  client.setQueriesData<GoalDTO[]>({ queryKey: queryKeys.goalsRoot }, (goals) =>
    goals?.map((current) => (current.id === goal.id ? goal : current)),
  );
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateGoalInput) => goalsApi.create(input),
    onSuccess: () => invalidateGoals(queryClient),
  });
}

/**
 * Sucesso: o estado calculado pelo servidor (PRG-02/03) substitui o item, sem atualização otimista.
 * Erro (403/409): a tela estava desatualizada → recarrega a lista.
 */
export function useUpdateGoal(goalId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: UpdateGoalInput) => goalsApi.update(goalId, changes),
    onSuccess: (goal) => applyGoal(queryClient, goal),
    onError: () => invalidateGoals(queryClient),
  });
}

export function useDeleteGoal(goalId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => goalsApi.remove(goalId),
    onSettled: () => invalidateGoals(queryClient),
  });
}
