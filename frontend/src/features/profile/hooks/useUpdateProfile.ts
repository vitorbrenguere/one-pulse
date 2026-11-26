import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Session } from '../../../lib/query-client';
import { queryKeys } from '../../../services/query-keys';
import { profileApi, type ProfileChanges } from '../api';

/** `PATCH /users/me`: a resposta substitui o usuário da sessão (o cabeçalho reflete na hora). */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: ProfileChanges) => profileApi.update(changes),
    onSuccess: (user) => queryClient.setQueryData<Session>(queryKeys.me, { user, expired: false }),
  });
}
