import type { ApiErrorDetail } from '../types/api';

export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? '/api/v1';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
  method?: HttpMethod;
  body?: unknown;
}

/** Erro normalizado a partir do envelope `{ error: { code, message, details } }` (spec 05 §3.2). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  void path;
  void options;
  throw new Error('Not implemented: apiRequest');
}
