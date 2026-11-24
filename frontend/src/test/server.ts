import { http, HttpResponse, type JsonBodyType, type PathParams } from 'msw';
import { setupServer } from 'msw/node';
import type { ApiErrorDetail, UserDTO } from '../types/api';

/** Prefixo dos handlers: qualquer origem + base padrão da API (spec 05 §2.1). */
const API_PATTERN = '*/api/v1';
const API_PATH = '/api/v1';

type Method = 'get' | 'post' | 'patch' | 'delete';

export interface ResolverInfo {
  request: Request;
  params: PathParams;
  url: URL;
}

export type Resolver = (info: ResolverInfo) => Response | Promise<Response>;

/** Padrão: ninguém logado. Cada teste sobrescreve com `mockMe`. */
export const server = setupServer(
  http.get(`${API_PATTERN}/auth/me`, () => apiError(401, 'UNAUTHENTICATED', 'Não autenticado.')),
);

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

export function ok(body: JsonBodyType, status = 200): Response {
  return HttpResponse.json(body, { status });
}

export function noContent(): Response {
  return new HttpResponse(null, { status: 204 });
}

export function apiError(status: number, code: string, message: string, details?: ApiErrorDetail[]): Response {
  return HttpResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status });
}

export function networkError(): Response {
  return HttpResponse.error();
}

/** Resposta que nunca chega (estado de carregamento). */
export function never(): Promise<Response> {
  return new Promise<Response>(() => undefined);
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export function mockApi(method: Method, path: string, resolver: Resolver, options: { once?: boolean } = {}): void {
  server.use(
    http[method](
      `${API_PATTERN}${path}`,
      ({ request, params }) => resolver({ request, params, url: new URL(request.url) }),
      options,
    ),
  );
}

/** `GET /auth/me`: usuário logado (ou `null` = 401). */
export function mockMe(user: UserDTO | null, options: { once?: boolean } = {}): void {
  mockApi(
    'get',
    '/auth/me',
    () => (user ? ok({ user }) : apiError(401, 'UNAUTHENTICATED', 'Não autenticado.')),
    options,
  );
}

// ---------------------------------------------------------------------------
// Registro das requisições (para "nenhuma requisição foi feita" e corpos enviados)
// ---------------------------------------------------------------------------

interface LoggedRequest {
  method: string;
  pathname: string;
  searchParams: URLSearchParams;
  body: Promise<unknown>;
}

const requestLog: LoggedRequest[] = [];

server.events.on('request:start', ({ request }) => {
  const url = new URL(request.url);
  requestLog.push({
    method: request.method,
    pathname: url.pathname,
    searchParams: url.searchParams,
    body: request
      .clone()
      .text()
      .then((text): unknown => (text ? JSON.parse(text) : undefined)),
  });
});

export function resetRequestLog(): void {
  requestLog.length = 0;
}

function matching(method: string, path: string): LoggedRequest[] {
  return requestLog.filter((r) => r.method === method && r.pathname === `${API_PATH}${path}`);
}

/** Requisições feitas para `METHOD /api/v1<path>` (path sem a base, sem query string). */
export function requestsTo(method: string, path: string): Array<{ searchParams: URLSearchParams }> {
  return matching(method, path).map(({ searchParams }) => ({ searchParams }));
}

export function countRequests(method: string, path: string): number {
  return matching(method, path).length;
}

/** Corpos JSON enviados para `METHOD /api/v1<path>`, na ordem. */
export async function bodiesOf(method: string, path: string): Promise<unknown[]> {
  return Promise.all(matching(method, path).map((r) => r.body));
}

export async function lastBody(method: string, path: string): Promise<unknown> {
  const bodies = await bodiesOf(method, path);
  return bodies.at(-1);
}
