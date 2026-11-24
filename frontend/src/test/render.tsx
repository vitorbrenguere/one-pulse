import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render, screen, within, type RenderResult } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '../features/auth/AuthProvider';
import { createQueryClient } from '../lib/query-client';
import { AppRoutes } from '../routes/AppRoutes';
import type { EvaluationDTO, GoalDTO, UserDTO } from '../types/api';
import { G } from './factories';
import { mockApi, mockMe, ok } from './server';

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location" hidden>
      {location.pathname}
      {location.search}
    </div>
  );
}

export interface RenderAppOptions {
  route?: string;
  /** Usuário do `GET /auth/me`. Omitido = handler padrão (401). */
  me?: UserDTO | null;
}

export interface RenderAppResult extends RenderResult {
  user: UserEvent;
  queryClient: QueryClient;
}

/** Renderiza a aplicação real (rotas + guards + providers) numa URL inicial. */
export function renderApp({ route = '/', me }: RenderAppOptions = {}): RenderAppResult {
  if (me !== undefined) mockMe(me);
  const queryClient = createQueryClient({ retryDelay: 0 });
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...view, user, queryClient };
}

/** Caminho atual (pathname + search) do MemoryRouter. */
export function currentPath(): string {
  return screen.getByTestId('location').textContent ?? '';
}

/** Congela apenas o `Date` (timers continuam reais para user-event, MSW e waitFor). */
export function freezeDate(iso = '2026-11-24T15:00:00.000Z'): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
}

/** Item de lista (`<li>`) dentro de `container` que contém `text`. */
export function listItemWith(container: HTMLElement, text: string | RegExp): HTMLElement {
  const item = within(container)
    .getAllByRole('listitem')
    .find((li) => within(li).queryByText(text) !== null);
  if (!item) throw new Error(`Nenhum listitem contém ${String(text)}`);
  return item;
}

// ---------------------------------------------------------------------------
// Cenários de dados comuns
// ---------------------------------------------------------------------------

/** Dados do próprio viewer: `GET /pd-goals` e `GET /evaluations` sem filtros. */
export function mockOwnData({ goals = [], evaluations = [] }: { goals?: GoalDTO[]; evaluations?: EvaluationDTO[] } = {}): void {
  mockApi('get', '/pd-goals', () => ok({ goals }));
  mockApi('get', '/evaluations', () => ok({ evaluations }));
}

/**
 * Dados de G: equipe, avaliações da equipe (sem `userId`), as próprias (`?userId=G`)
 * e as de um liderado (`?userId=<id>`), além das próprias metas.
 */
export function mockManagerData({
  team = [],
  teamEvaluations = [],
  ownEvaluations = [],
  ownGoals = [],
}: {
  team?: UserDTO[];
  teamEvaluations?: EvaluationDTO[];
  ownEvaluations?: EvaluationDTO[];
  ownGoals?: GoalDTO[];
} = {}): void {
  mockApi('get', '/users/team', () => ok({ users: team }));
  mockApi('get', '/pd-goals', () => ok({ goals: ownGoals }));
  mockApi('get', '/evaluations', ({ url }) => {
    const userId = url.searchParams.get('userId');
    if (userId === String(G.id)) return ok({ evaluations: ownEvaluations });
    if (userId) return ok({ evaluations: teamEvaluations.filter((e) => String(e.userId) === userId) });
    return ok({ evaluations: teamEvaluations });
  });
}
