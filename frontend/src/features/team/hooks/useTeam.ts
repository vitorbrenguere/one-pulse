import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../../../services/query-keys';
import { usersApi } from '../api';

/** Liderados diretos (`GET /users/team`, só GESTOR). */
export function useTeam({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: queryKeys.team, queryFn: usersApi.team, enabled });
}

export function useUser(id: number) {
  return useQuery({ queryKey: queryKeys.user(id), queryFn: () => usersApi.get(id) });
}
