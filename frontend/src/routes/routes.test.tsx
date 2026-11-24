import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { C1 } from '../test/factories';
import { currentPath, mockOwnData, renderApp } from '../test/render';
import { apiError, countRequests, mockApi, mockMe, never, ok } from '../test/server';

describe('guards e rotas (spec 05 §5)', () => {
  it('[UI-08] enquanto /auth/me não responde: loader de página inteira e nenhum conteúdo protegido', async () => {
    mockApi('get', '/auth/me', () => never());

    renderApp({ route: '/dashboard' });

    expect(await screen.findByRole('status')).toHaveTextContent(/carregando/i);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument();
    expect(countRequests('GET', '/pd-goals')).toBe(0);
  });

  it('[UI-09] deslogado em /goals vai para /login e, após o login, volta para /goals', async () => {
    const { user } = renderApp({ route: '/goals' });

    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(screen.getByRole('heading', { level: 1, name: 'Entrar' })).toBeInTheDocument();

    mockApi('post', '/auth/login', () => ok({ user: C1 }));
    mockMe(C1);
    mockOwnData();

    await user.type(screen.getByLabelText('E-mail'), C1.email);
    await user.type(screen.getByLabelText('Senha'), 'onepulse123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(currentPath()).toBe('/goals'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Metas de PDI' })).toBeInTheDocument();
  });

  it.each(['/login', '/register'])('[UI-10] logado em %s é redirecionado para /dashboard', async (route) => {
    mockOwnData();

    renderApp({ route, me: C1 });

    await waitFor(() => expect(currentPath()).toBe('/dashboard'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('[UI-11] / redireciona para /dashboard', async () => {
    mockOwnData();

    renderApp({ route: '/', me: C1 });

    await waitFor(() => expect(currentPath()).toBe('/dashboard'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
  });

  it('[UI-11] rota inexistente mostra "Página não encontrada" com link para o dashboard', async () => {
    renderApp({ route: '/rota-inexistente', me: C1 });

    expect(await screen.findByRole('heading', { level: 1, name: 'Página não encontrada' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao dashboard' })).toHaveAttribute('href', '/dashboard');
  });

  it('[UI-12] COLABORADOR em /team/2 é redirecionado para /dashboard sem consultar o usuário', async () => {
    mockOwnData();

    renderApp({ route: '/team/2', me: C1 });

    await waitFor(() => expect(currentPath()).toBe('/dashboard'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(countRequests('GET', '/users/2')).toBe(0);
    expect(countRequests('GET', '/pd-goals')).toBeGreaterThan(0); // dashboard carregou: o guard rodou de fato
  });

  it('[UI-13] 401 numa query no meio da sessão: limpa o cache, vai para /login e avisa que a sessão expirou', async () => {
    mockMe(C1, { once: true }); // 1ª chamada: logado; depois, o handler padrão (401)
    mockApi('get', '/pd-goals', () => apiError(401, 'UNAUTHENTICATED', 'Não autenticado.'));

    const { queryClient } = renderApp({ route: '/goals' });

    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(await screen.findByText('Sua sessão expirou. Entre novamente.')).toBeInTheDocument();
    const goalQueriesWithData = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['goals'] })
      .filter((query) => query.state.data !== undefined);
    expect(goalQueriesWithData).toHaveLength(0);
    expect(countRequests('GET', '/pd-goals')).toBe(1); // 401 não é retentado
  });
});
