import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { C1 } from '../../../test/factories';
import { currentPath, mockOwnData, renderApp } from '../../../test/render';
import { apiError, countRequests, lastBody, mockApi, mockMe, never, ok } from '../../../test/server';

async function renderLogin() {
  const view = renderApp({ route: '/login' });
  await screen.findByRole('heading', { level: 1, name: 'Entrar' });
  return view;
}

describe('LoginPage (spec 05 §6.1)', () => {
  it('[UI-16] login válido: envia { email, password } e navega para /dashboard com o nome do usuário', async () => {
    const { user } = await renderLogin();
    mockApi('post', '/auth/login', () => ok({ user: C1 }));
    mockMe(C1);
    mockOwnData();

    await user.type(screen.getByLabelText('E-mail'), C1.email);
    await user.type(screen.getByLabelText('Senha'), 'onepulse123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(currentPath()).toBe('/dashboard'));
    expect(await lastBody('POST', '/auth/login')).toEqual({ email: C1.email, password: 'onepulse123' });
    expect(await screen.findByRole('banner')).toHaveTextContent(C1.name);
  });

  it('[UI-17] 401 INVALID_CREDENTIALS: alerta com a mensagem da API, senha limpa e e-mail preservado', async () => {
    const { user } = await renderLogin();
    mockApi('post', '/auth/login', () => apiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.'));

    await user.type(screen.getByLabelText('E-mail'), C1.email);
    await user.type(screen.getByLabelText('Senha'), 'errada123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha inválidos.');
    expect(screen.getByLabelText('Senha')).toHaveValue('');
    expect(screen.getByLabelText('E-mail')).toHaveValue(C1.email);
    expect(currentPath()).toBe('/login');
  });

  it.each([
    ['campos vazios', '', '', ['E-mail', 'Senha']],
    ['e-mail mal formado', 'ana', 'qualquer1', ['E-mail']],
  ])('[UI-18] login com %s: erro por campo e nenhuma requisição', async (_case, email, password, invalidFields) => {
    const { user } = await renderLogin();

    if (email) await user.type(screen.getByLabelText('E-mail'), email);
    if (password) await user.type(screen.getByLabelText('Senha'), password);
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    for (const label of ['E-mail', 'Senha']) {
      const field = screen.getByLabelText(label);
      if (invalidFields.includes(label)) {
        expect(field).toHaveAttribute('aria-invalid', 'true');
        expect(field).toHaveAccessibleDescription(/.+/);
      } else {
        expect(field).not.toHaveAttribute('aria-invalid', 'true');
      }
    }
    expect(countRequests('POST', '/auth/login')).toBe(0);
  });

  it('[UI-19] 400 VALIDATION_ERROR: cada details[] aparece no campo correspondente', async () => {
    const { user } = await renderLogin();
    mockApi('post', '/auth/login', () =>
      apiError(400, 'VALIDATION_ERROR', 'Dados inválidos.', [
        { field: 'email', message: 'E-mail inválido (servidor).' },
        { field: 'password', message: 'Senha inválida (servidor).' },
      ]),
    );

    await user.type(screen.getByLabelText('E-mail'), C1.email);
    await user.type(screen.getByLabelText('Senha'), 'onepulse123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() =>
      expect(screen.getByLabelText('E-mail')).toHaveAccessibleDescription(expect.stringContaining('E-mail inválido (servidor).')),
    );
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Senha')).toHaveAccessibleDescription(expect.stringContaining('Senha inválida (servidor).'));
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true');
  });

  it('[UI-20] requisição pendente: botão desabilitado com "Entrando…" e sem envio duplicado', async () => {
    const { user } = await renderLogin();
    mockApi('post', '/auth/login', () => never());

    await user.type(screen.getByLabelText('E-mail'), C1.email);
    await user.type(screen.getByLabelText('Senha'), 'onepulse123');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    const pending = await screen.findByRole('button', { name: 'Entrando…' });
    expect(pending).toBeDisabled();
    await user.click(pending);
    expect(countRequests('POST', '/auth/login')).toBe(1);
  });

  it('[UI-24] link "Criar conta" leva para /register', async () => {
    const { user } = await renderLogin();

    await user.click(screen.getByRole('link', { name: 'Criar conta' }));

    await waitFor(() => expect(currentPath()).toBe('/register'));
    expect(screen.getByRole('heading', { level: 1, name: 'Criar conta' })).toBeInTheDocument();
  });
});
