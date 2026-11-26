import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { ApiError } from '../../services/http';
import { queryKeys } from '../../services/query-keys';
import type { Session } from '../../lib/query-client';
import type { UserDTO } from '../../types/api';
import { authApi } from './api';

async function fetchSession(): Promise<Session> {
  try {
    const { user } = await authApi.me();
    return { user, expired: false };
  } catch (error) {
    // 401 em /auth/me não é erro: significa "deslogado" (spec 05 §3.3).
    if (error instanceof ApiError && error.status === 401) return { user: null, expired: false };
    throw error;
  }
}

/** A sessão é só a query `['auth','me']`; mudanças chegam por `setQueryData` (login, logout, perfil). */
export function useSessionQuery(): UseQueryResult<Session> {
  return useQuery({ queryKey: queryKeys.me, queryFn: fetchSession, retry: false, staleTime: Infinity });
}

export const AuthContext = createContext<UseQueryResult<Session> | null>(null);

export function useSession(): UseQueryResult<Session> {
  const session = useContext(AuthContext);
  if (!session) throw new Error('useSession deve ser usado dentro de <AuthProvider>.');
  return session;
}

/** Usuário logado; só pode ser usado abaixo de `RequireAuth`. */
export function useCurrentUser(): UserDTO {
  const user = useSession().data?.user;
  if (!user) throw new Error('useCurrentUser exige uma sessão ativa (use dentro de <RequireAuth>).');
  return user;
}
