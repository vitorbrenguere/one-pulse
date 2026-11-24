import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { C1, G } from '../../test/factories';
import { currentPath, mockManagerData, mockOwnData, renderApp } from '../../test/render';
import { apiError, countRequests, mockApi, mockMe, networkError, noContent } from '../../test/server';

describe('AppShell (spec 05 §5)', () => {
  it.each([
    ['API responde 204', () => noContent()],
    ['API responde 500', () => apiError(500, 'INTERNAL_ERROR', 'Erro inesperado no servidor.')],
    ['rede indisponível', () => networkError()],
  ])('[UI-14] "Sair" (%s): chama o logout, vai para /login e não deixa dados em cache', async (_case, logoutResponse) => {
    mockOwnData();
    const { user, queryClient } = renderApp({ route: '/dashboard', me: C1 });
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' });

    mockApi('post', '/auth/logout', logoutResponse);
    mockMe(null);
    await user.click(screen.getByRole('button', { name: 'Sair' }));

    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(countRequests('POST', '/auth/logout')).toBe(1);
    const cachedData = queryClient
      .getQueryCache()
      .findAll()
      .filter((query) => query.queryKey[0] !== 'auth' && query.state.data !== undefined);
    expect(cachedData).toHaveLength(0);
    expect(queryClient.getQueryData(['auth', 'me'])).not.toEqual({ user: C1 });
  });

  it.each([
    ['COLABORADOR', C1, 'Colaborador', () => mockOwnData()],
    ['GESTOR', G, 'Gestor', () => mockManagerData()],
  ])('[UI-15] %s: cabeçalho com nome, badge do papel e link ativo', async (_role, me, roleLabel, mockData) => {
    mockData();
    renderApp({ route: '/goals', me });

    const banner = await screen.findByRole('banner');
    expect(await within(banner).findByText(me.name)).toBeInTheDocument();
    expect(within(banner).getByText(roleLabel)).toBeInTheDocument();

    const nav = within(banner).getByRole('navigation');
    expect(within(nav).getByRole('link', { name: 'Metas' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: 'Avaliações' })).toHaveAttribute('href', '/evaluations');
  });

  it('[UI-15] menu mobile abre e fecha pelo botão com aria-expanded', async () => {
    mockOwnData();
    const { user } = renderApp({ route: '/goals', me: C1 });

    const toggle = await screen.findByRole('button', { name: 'Menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});
