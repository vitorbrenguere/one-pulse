import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { UserDTO } from '../../../types/api';
import { C1 } from '../../../test/factories';
import { mockOwnData, renderApp } from '../../../test/render';
import { apiError, countRequests, lastBody, mockApi, ok } from '../../../test/server';

/** PATCH /users/me que aplica o corpo sobre o usuário atual (como o back-end). */
function mockProfileUpdate(initial: UserDTO): void {
  let current = initial;
  mockApi('patch', '/users/me', async ({ request }) => {
    const body = (await request.json()) as Partial<Pick<UserDTO, 'name' | 'jobTitle'>>;
    current = { ...current, ...body };
    return ok({ user: current });
  });
}

async function openProfileEditor() {
  mockOwnData();
  const view = renderApp({ route: '/dashboard', me: C1 });
  const region = await screen.findByRole('region', { name: 'Meu perfil' });
  await within(region).findByText(C1.email);
  await view.user.click(within(region).getByRole('button', { name: 'Editar perfil' }));
  return { ...view, region };
}

describe('ProfileCard (spec 05 §6.2)', () => {
  it('[UI-30] mostra os dados; alterar só o cargo envia { jobTitle }; apagar o cargo envia { jobTitle: null }', async () => {
    mockProfileUpdate(C1);
    const { user, region } = await openProfileEditor();

    const jobTitle = within(region).getByLabelText('Cargo');
    expect(jobTitle).toHaveValue('Desenvolvedor Júnior');
    await user.clear(jobTitle);
    await user.type(jobTitle, 'Desenvolvedor Pleno');
    await user.click(within(region).getByRole('button', { name: 'Salvar' }));

    expect(await within(region).findByText('Desenvolvedor Pleno')).toBeInTheDocument();
    expect(await lastBody('PATCH', '/users/me')).toEqual({ jobTitle: 'Desenvolvedor Pleno' });

    await user.click(within(region).getByRole('button', { name: 'Editar perfil' }));
    await user.clear(within(region).getByLabelText('Cargo'));
    await user.click(within(region).getByRole('button', { name: 'Salvar' }));

    expect(await within(region).findByText('Cargo não informado')).toBeInTheDocument();
    expect(await lastBody('PATCH', '/users/me')).toEqual({ jobTitle: null });
    expect(within(region).queryByText('Desenvolvedor Pleno')).not.toBeInTheDocument();
  });

  it('[UI-31] alterar o nome envia só { name } e o cabeçalho reflete o novo nome', async () => {
    mockProfileUpdate(C1);
    const { user, region } = await openProfileEditor();

    const name = within(region).getByLabelText('Nome');
    await user.clear(name);
    await user.type(name, 'Carlos Lima Souza');
    await user.click(within(region).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.getByRole('banner')).toHaveTextContent('Carlos Lima Souza'));
    expect(await lastBody('PATCH', '/users/me')).toEqual({ name: 'Carlos Lima Souza' });
  });

  it('[UI-32] sem alterações, "Salvar" fica desabilitado', async () => {
    const { region } = await openProfileEditor();

    expect(within(region).getByRole('button', { name: 'Salvar' })).toBeDisabled();
    expect(countRequests('PATCH', '/users/me')).toBe(0);
  });

  it('[UI-32] 400 com details de name: erro exibido no campo nome', async () => {
    mockApi('patch', '/users/me', () =>
      apiError(400, 'VALIDATION_ERROR', 'Dados inválidos.', [
        { field: 'name', message: 'Nome deve ter entre 2 e 120 caracteres.' },
      ]),
    );
    const { user, region } = await openProfileEditor();

    const name = within(region).getByLabelText('Nome');
    await user.clear(name);
    await user.type(name, 'Al');
    await user.click(within(region).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(within(region).getByLabelText('Nome')).toHaveAccessibleDescription(
        expect.stringContaining('Nome deve ter entre 2 e 120 caracteres.'),
      ),
    );
    expect(within(region).getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
  });
});
