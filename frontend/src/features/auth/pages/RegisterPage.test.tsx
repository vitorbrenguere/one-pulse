import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeUser } from '../../../test/factories';
import { currentPath, mockOwnData, renderApp } from '../../../test/render';
import { apiError, countRequests, lastBody, mockApi, mockMe, never, ok } from '../../../test/server';

const NAME_MESSAGE = 'Nome deve ter entre 2 e 120 caracteres.';
const EMAIL_MESSAGE = 'E-mail inválido.';
const PASSWORD_MESSAGE = 'Senha deve ter entre 8 e 72 caracteres, com ao menos uma letra e um número.';

const ANA = makeUser({ id: 77, name: 'Ana Souza', email: 'ana@onepulse.dev' });

async function renderRegister() {
  const view = renderApp({ route: '/register' });
  await screen.findByRole('heading', { level: 1, name: 'Criar conta' });
  return view;
}

function submitButton() {
  return screen.getByRole('button', { name: 'Criar conta' });
}

describe('RegisterPage (spec 05 §6.1)', () => {
  it('[UI-18] cadastro vazio: mensagens da spec 01 em cada campo e nenhuma requisição', async () => {
    const { user } = await renderRegister();

    await user.click(submitButton());

    const expectations: Array<[string, string]> = [
      ['Nome', NAME_MESSAGE],
      ['E-mail', EMAIL_MESSAGE],
      ['Senha', PASSWORD_MESSAGE],
    ];
    for (const [label, message] of expectations) {
      const field = screen.getByLabelText(label);
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription(expect.stringContaining(message));
    }
    expect(countRequests('POST', '/auth/register')).toBe(0);
  });

  it.each(['abc1234', 'abcdefgh', '12345678'])(
    '[UI-21] senha fora da política (%s): mensagem no campo senha e nenhuma requisição',
    async (password) => {
      const { user } = await renderRegister();

      await user.type(screen.getByLabelText('Nome'), 'Ana Souza');
      await user.type(screen.getByLabelText('E-mail'), 'ana@onepulse.dev');
      await user.type(screen.getByLabelText('Senha'), password);
      await user.click(submitButton());

      const field = screen.getByLabelText('Senha');
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription(expect.stringContaining(PASSWORD_MESSAGE));
      expect(screen.getByLabelText('Nome')).not.toHaveAttribute('aria-invalid', 'true');
      expect(countRequests('POST', '/auth/register')).toBe(0);
    },
  );

  it('[UI-22] cadastro válido: register e depois login com as mesmas credenciais, indo para /dashboard', async () => {
    const { user } = await renderRegister();
    mockApi('post', '/auth/register', () => ok({ user: ANA }, 201));
    mockApi('post', '/auth/login', () => ok({ user: ANA }));
    mockMe(ANA);
    mockOwnData();

    await user.type(screen.getByLabelText('Nome'), 'Ana Souza');
    await user.type(screen.getByLabelText('E-mail'), 'ana@onepulse.dev');
    await user.type(screen.getByLabelText('Senha'), 'segura123');
    await user.click(submitButton());

    await waitFor(() => expect(currentPath()).toBe('/dashboard'));
    expect(await lastBody('POST', '/auth/register')).toEqual({
      name: 'Ana Souza',
      email: 'ana@onepulse.dev',
      password: 'segura123',
    });
    expect(await lastBody('POST', '/auth/login')).toEqual({ email: 'ana@onepulse.dev', password: 'segura123' });
  });

  it('[UI-22] se o login automático falhar, vai para /login com "Conta criada. Entre para continuar."', async () => {
    const { user } = await renderRegister();
    mockApi('post', '/auth/register', () => ok({ user: ANA }, 201));
    mockApi('post', '/auth/login', () => apiError(500, 'INTERNAL_ERROR', 'Erro inesperado no servidor.'));

    await user.type(screen.getByLabelText('Nome'), 'Ana Souza');
    await user.type(screen.getByLabelText('E-mail'), 'ana@onepulse.dev');
    await user.type(screen.getByLabelText('Senha'), 'segura123');
    await user.click(submitButton());

    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(await screen.findByText('Conta criada. Entre para continuar.')).toBeInTheDocument();
  });

  it('[UI-23] 409 EMAIL_ALREADY_IN_USE: mensagem da API no campo e-mail', async () => {
    const { user } = await renderRegister();
    mockApi('post', '/auth/register', () =>
      apiError(409, 'EMAIL_ALREADY_IN_USE', 'Este e-mail já está em uso.'),
    );

    await user.type(screen.getByLabelText('Nome'), 'Ana Souza');
    await user.type(screen.getByLabelText('E-mail'), 'ana@onepulse.dev');
    await user.type(screen.getByLabelText('Senha'), 'segura123');
    await user.click(submitButton());

    await waitFor(() =>
      expect(screen.getByLabelText('E-mail')).toHaveAccessibleDescription(
        expect.stringContaining('Este e-mail já está em uso.'),
      ),
    );
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
    expect(countRequests('POST', '/auth/login')).toBe(0);
  });

  it('[UI-20] cadastro pendente: botão desabilitado com "Criando conta…"', async () => {
    const { user } = await renderRegister();
    mockApi('post', '/auth/register', () => never());

    await user.type(screen.getByLabelText('Nome'), 'Ana Souza');
    await user.type(screen.getByLabelText('E-mail'), 'ana@onepulse.dev');
    await user.type(screen.getByLabelText('Senha'), 'segura123');
    await user.click(submitButton());

    const pending = await screen.findByRole('button', { name: 'Criando conta…' });
    expect(pending).toBeDisabled();
    await user.click(pending);
    expect(countRequests('POST', '/auth/register')).toBe(1);
  });

  it('[UI-24] link "Já tenho conta" leva para /login', async () => {
    const { user } = await renderRegister();

    await user.click(screen.getByRole('link', { name: 'Já tenho conta' }));

    await waitFor(() => expect(currentPath()).toBe('/login'));
  });
});
