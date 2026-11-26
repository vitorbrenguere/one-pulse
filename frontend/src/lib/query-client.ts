import { MutationCache, QueryCache, QueryClient, type QueryKey } from '@tanstack/react-query';
import { ApiError } from '../services/http';
import { queryKeys } from '../services/query-keys';
import type { UserDTO } from '../types/api';

/** Dado da query `['auth','me']`: a sessão é estado de servidor (spec 05 §3.3, D-01). */
export interface Session {
  user: UserDTO | null;
  /** `true` quando a sessão caiu por um 401 no meio do uso (mostra o aviso no login). */
  expired: boolean;
}

export interface CreateQueryClientOptions {
  /** Atraso entre retentativas (ms). Os testes usam 0. */
  retryDelay?: number;
}

const isMeQuery = (key: QueryKey): boolean => key[0] === queryKeys.me[0] && key[1] === queryKeys.me[1];

/** Retentar só o que pode ser transitório: rede ou 5xx. Nunca 4xx. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 1) return false;
  return error instanceof ApiError && (error.code === 'NETWORK_ERROR' || error.status >= 500);
}

/**
 * Marca a sessão como encerrada e descarta os dados de servidor.
 * A remoção acontece no tick seguinte: primeiro o guard redireciona (desmontando as telas);
 * remover antes faria uma tela ainda montada recriar a query e disparar um novo GET.
 */
export function endSession(client: QueryClient, { expired }: { expired: boolean }): void {
  client.setQueryData<Session>(queryKeys.me, { user: null, expired });
  setTimeout(() => client.removeQueries({ predicate: (query) => !isMeQuery(query.queryKey) }), 0);
}

/**
 * QueryClient da aplicação: política de retry e tratamento global de 401 (sessão expirada).
 * O 401 do próprio `/auth/me` não passa por aqui: lá ele significa "deslogado", não erro.
 */
export function createQueryClient(options: CreateQueryClientOptions = {}): QueryClient {
  const onUnauthorized = (error: unknown, key?: QueryKey): void => {
    if (!(error instanceof ApiError) || error.status !== 401) return;
    if (key && isMeQuery(key)) return;
    endSession(client, { expired: true });
  };

  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError: (error, query) => onUnauthorized(error, query.queryKey) }),
    mutationCache: new MutationCache({ onError: (error) => onUnauthorized(error) }),
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        refetchOnWindowFocus: false,
        ...(options.retryDelay === undefined ? {} : { retryDelay: options.retryDelay }),
      },
      mutations: { retry: 0 },
    },
  });

  return client;
}
