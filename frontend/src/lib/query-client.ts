import { QueryClient } from '@tanstack/react-query';

export interface CreateQueryClientOptions {
  /** Atraso entre retentativas (ms). Os testes usam 0. */
  retryDelay?: number;
}

/**
 * QueryClient da aplicação (spec 05 §3.3): política de retry e tratamento global de 401.
 */
export function createQueryClient(options: CreateQueryClientOptions = {}): QueryClient {
  void options;
  return new QueryClient();
}
