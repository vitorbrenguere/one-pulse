import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UserDTO } from '../types/api';
import { C1, G, L1 } from './factories';
import { mockManagerData, mockOwnData, renderApp } from './render';
import { apiError, mockApi, networkError, never } from './server';

type Responder = () => Response | Promise<Response>;

interface ListCase {
  name: string;
  route: string;
  me: UserDTO;
  path: string;
  heading: string;
  mockRest: () => void;
}

const LISTS: ListCase[] = [
  { name: 'metas', route: '/goals', me: C1, path: '/pd-goals', heading: 'Metas de PDI', mockRest: () => mockOwnData() },
  { name: 'equipe', route: '/dashboard', me: G, path: '/users/team', heading: 'Dashboard', mockRest: () => mockManagerData() },
  {
    name: 'avaliações',
    route: '/evaluations',
    me: C1,
    path: '/evaluations',
    heading: 'Avaliações de desempenho',
    mockRest: () => mockOwnData(),
  },
];

const FAILURES: Array<[string, Responder, string]> = [
  ['500', () => apiError(500, 'INTERNAL_ERROR', 'Erro inesperado no servidor.'), 'Erro inesperado no servidor.'],
  ['rede indisponível', () => networkError(), 'Não foi possível conectar ao servidor.'],
];

describe('estados de carregamento e erro (spec 05 §4.3)', () => {
  it.each(LISTS)('[UI-62] lista de $name: LoadingState enquanto carrega', async ({ route, me, path, heading, mockRest }) => {
    mockRest();
    mockApi('get', path, () => never());

    renderApp({ route, me });

    await screen.findByRole('heading', { level: 1, name: heading });
    expect(await screen.findByRole('status')).toHaveTextContent(/carregando/i);
  });

  describe.each(LISTS)('[UI-62] lista de $name', ({ route, me, path, heading, mockRest }) => {
    it.each(FAILURES)('com %s: ErrorBanner com a mensagem e "Tentar novamente"', async (_case, respond, message) => {
      mockRest();
      mockApi('get', path, respond);

      renderApp({ route, me });

      await screen.findByRole('heading', { level: 1, name: heading });
      const alert = await screen.findByRole('alert', {}, { timeout: 3000 });
      expect(alert).toHaveTextContent(message);
      expect(within(alert).getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    });
  });
});

/** Todo input/select/textarea visível tem nome acessível (label associado). */
function expectAllFieldsLabelled(container: HTMLElement): void {
  const fields = Array.from(container.querySelectorAll<HTMLElement>('input, select, textarea')).filter(
    (el) => el.getAttribute('type') !== 'hidden',
  );
  expect(fields.length).toBeGreaterThan(0);
  for (const field of fields) expect(field).toHaveAccessibleName();
}

describe('acessibilidade dos formulários e diálogos (spec 05 §4.1, §4.3)', () => {
  it.each([
    ['login', '/login', 'Entrar'],
    ['cadastro', '/register', 'Criar conta'],
  ])('[UI-63] formulário de %s: todos os campos com label', async (_name, route, heading) => {
    renderApp({ route });

    await screen.findByRole('heading', { level: 1, name: heading });
    expectAllFieldsLabelled(document.body);
  });

  it('[UI-63] edição de perfil: todos os campos com label', async () => {
    mockOwnData();
    const { user } = renderApp({ route: '/dashboard', me: C1 });

    const region = await screen.findByRole('region', { name: 'Meu perfil' });
    await user.click(await within(region).findByRole('button', { name: 'Editar perfil' }));

    expectAllFieldsLabelled(region);
  });

  it('[UI-63] diálogo "Nova meta": nome acessível, foco dentro, Esc fecha e devolve o foco ao botão de origem', async () => {
    mockOwnData();
    const { user } = renderApp({ route: '/goals', me: C1 });

    const trigger = await screen.findByRole('button', { name: 'Nova meta' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Nova meta' });

    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    expectAllFieldsLabelled(dialog);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('[UI-63] diálogo "Abrir avaliação": nome acessível, campos com label e Esc fecha', async () => {
    mockManagerData({ team: [L1] });
    const { user } = renderApp({ route: '/evaluations', me: G });

    const trigger = await screen.findByRole('button', { name: 'Abrir avaliação' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Abrir avaliação' });

    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    expectAllFieldsLabelled(dialog);

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});
