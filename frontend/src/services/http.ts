import type { ApiErrorBody, ApiErrorDetail } from '../types/api';

export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? '/api/v1';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions {
  method?: HttpMethod;
  body?: unknown;
}

const NETWORK_ERROR_MESSAGE = 'Não foi possível conectar ao servidor.';
const UNEXPECTED_MESSAGE = 'Erro inesperado. Tente novamente.';

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

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const { error } = value;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Único ponto de acesso HTTP do front-end. Sempre envia o cookie de sessão (`credentials: 'include'`).
 * A URL é resolvida contra a origem atual para funcionar igual no navegador e no jsdom.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'GET', body } = options;
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);
  const init: RequestInit = { method, credentials: 'include' };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', NETWORK_ERROR_MESSAGE);
  }

  if (response.status === 204) return undefined as T;

  const payload = await readJson(response);
  if (response.ok) return payload as T;

  if (isErrorBody(payload)) {
    const { code, message, details } = payload.error;
    throw new ApiError(response.status, code, message, details ?? []);
  }
  throw new ApiError(response.status, 'UNEXPECTED_RESPONSE', UNEXPECTED_MESSAGE);
}

/** Mensagem exibível para qualquer erro (ApiError ou inesperado). */
export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : UNEXPECTED_MESSAGE;
}
