import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { apiError, noContent, ok, server } from '../test/server';
import { ApiError, apiRequest } from './http';

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Era esperado que a promise rejeitasse.');
}

describe('apiRequest', () => {
  it('[UI-01] GET sem corpo: chama <base><path> com credentials include e sem Content-Type', async () => {
    const captured: Request[] = [];
    server.use(
      http.get('*/api/v1/ping', ({ request }) => {
        captured.push(request);
        return HttpResponse.json({ pong: true });
      }),
    );

    await apiRequest('/ping');

    expect(captured).toHaveLength(1);
    const [request] = captured;
    expect(request?.method).toBe('GET');
    expect(new URL(request?.url ?? '').pathname).toBe('/api/v1/ping');
    expect(request?.credentials).toBe('include');
    expect(request?.headers.get('content-type')).toBeNull();
  });

  it('[UI-01] POST com corpo: envia JSON serializado com Content-Type application/json e credentials include', async () => {
    const captured: Array<{ request: Request; body: unknown }> = [];
    server.use(
      http.post('*/api/v1/echo', async ({ request }) => {
        captured.push({ request, body: await request.clone().json() });
        return HttpResponse.json({ ok: true }, { status: 201 });
      }),
    );

    await apiRequest('/echo', { method: 'POST', body: { name: 'Ana', tags: ['a'] } });

    expect(captured).toHaveLength(1);
    const [entry] = captured;
    expect(entry?.request.headers.get('content-type')).toMatch(/^application\/json/);
    expect(entry?.request.credentials).toBe('include');
    expect(entry?.body).toEqual({ name: 'Ana', tags: ['a'] });
  });

  it('[UI-02] 200 com JSON devolve o corpo', async () => {
    server.use(http.get('*/api/v1/goals-x', () => ok({ goals: [{ id: 1 }] })));

    await expect(apiRequest('/goals-x')).resolves.toEqual({ goals: [{ id: 1 }] });
  });

  it('[UI-02] 204 sem corpo devolve undefined', async () => {
    server.use(http.delete('*/api/v1/goals-x/1', () => noContent()));

    await expect(apiRequest('/goals-x/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('[UI-03] 400 VALIDATION_ERROR: lança ApiError com status, code, message e details', async () => {
    const details = [{ field: 'email', message: 'E-mail inválido.' }];
    server.use(http.post('*/api/v1/auth/register', () => apiError(400, 'VALIDATION_ERROR', 'Dados inválidos.', details)));

    const error = await captureError(apiRequest('/auth/register', { method: 'POST', body: {} }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: 'Dados inválidos.', details });
  });

  it('[UI-03] 409 sem details: lança ApiError com details = []', async () => {
    server.use(
      http.patch('*/api/v1/pd-goals/5', () =>
        apiError(409, 'GOAL_LOCKED', 'Metas concluídas ou canceladas não podem ser alteradas.'),
      ),
    );

    const error = await captureError(apiRequest('/pd-goals/5', { method: 'PATCH', body: { progress: 1 } }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'GOAL_LOCKED',
      message: 'Metas concluídas ou canceladas não podem ser alteradas.',
      details: [],
    });
  });

  it('[UI-04] não-2xx sem envelope (502 com HTML): ApiError UNEXPECTED_RESPONSE com mensagem genérica', async () => {
    server.use(http.get('*/api/v1/ping', () => HttpResponse.html('<h1>Bad Gateway</h1>', { status: 502 })));

    const error = await captureError(apiRequest('/ping'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 502,
      code: 'UNEXPECTED_RESPONSE',
      message: 'Erro inesperado. Tente novamente.',
      details: [],
    });
  });

  it('[UI-04] falha de rede: ApiError(0, NETWORK_ERROR)', async () => {
    server.use(http.get('*/api/v1/ping', () => HttpResponse.error()));

    const error = await captureError(apiRequest('/ping'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Não foi possível conectar ao servidor.',
    });
  });
});
