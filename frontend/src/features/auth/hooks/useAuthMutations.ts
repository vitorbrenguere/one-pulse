import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { endSession, type Session } from '../../../lib/query-client';
import { queryKeys } from '../../../services/query-keys';
import type { UserDTO } from '../../../types/api';
import { authApi, type LoginInput, type RegisterInput } from '../api';
import { ACCOUNT_CREATED_NOTICE, type AuthRedirectState } from '../redirect-state';

function useStartSession(): (user: UserDTO) => void {
  const queryClient = useQueryClient();
  return (user) => queryClient.setQueryData<Session>(queryKeys.me, { user, expired: false });
}

/** Login: grava o usuário na sessão; o `PublicOnly` cuida do redirecionamento. */
export function useLogin() {
  const startSession = useStartSession();
  return useMutation({
    mutationFn: (input: LoginInput) => authApi.login(input),
    onSuccess: ({ user }) => startSession(user),
  });
}

type RegisterResult = { user: UserDTO } | { user: null };

/** Cadastro + login automático (spec 05 Q-01). Se o login falhar, a conta já existe: vai para /login. */
export function useRegister() {
  const startSession = useStartSession();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (input: RegisterInput): Promise<RegisterResult> => {
      await authApi.register(input);
      try {
        return await authApi.login({ email: input.email, password: input.password });
      } catch {
        return { user: null };
      }
    },
    onSuccess: ({ user }) => {
      if (user) {
        startSession(user);
        return;
      }
      const state: AuthRedirectState = { notice: ACCOUNT_CREATED_NOTICE };
      navigate('/login', { replace: true, state });
    },
  });
}

/** Logout: limpa o cache mesmo se a chamada falhar (a rota é idempotente). */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      navigate('/login', { replace: true });
      endSession(queryClient, { expired: false });
    },
  });
}
