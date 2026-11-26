import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GoalDTO } from '../../../types/api';
import { C1, makeGoal } from '../../../test/factories';
import { mockGoalsStore } from '../../../test/goals-store';
import { currentPath, renderApp, freezeDate } from '../../../test/render';
import { apiError, countRequests, lastBody, mockApi, ok } from '../../../test/server';

function setup(goals: GoalDTO[], route = '/goals') {
  freezeDate('2026-11-24T15:00:00.000Z');
  mockApi('get', '/evaluations', () => ok({ evaluations: [] }));
  const store = mockGoalsStore(C1.id, goals);
  const view = renderApp({ route, me: C1 });
  return { ...view, store };
}

async function findArticle(title: string): Promise<HTMLElement> {
  return screen.findByRole('article', { name: title });
}

/** Texto visível fora de <option> (o select de status também contém os rótulos). */
const NOT_OPTION = { selector: ':not(option)' } as const;

const ALL_STATUSES: GoalDTO[] = [
  makeGoal({ title: 'Meta não iniciada', status: 'NAO_INICIADA' }),
  makeGoal({ title: 'Meta em andamento', status: 'EM_ANDAMENTO', progress: 40 }),
  makeGoal({ title: 'Meta concluída', status: 'CONCLUIDA', progress: 100, completedAt: '2026-11-10T12:00:00.000Z' }),
  makeGoal({ title: 'Meta cancelada', status: 'CANCELADA', progress: 20 }),
];

describe('GoalsPage — listagem e filtros (spec 05 §6.4.1)', () => {
  it('[UI-35] cada meta mostra título, categoria, status, progresso, prazo e parecer com data', async () => {
    setup([
      makeGoal({
        title: 'Aprender testes de integração',
        description: 'Cobrir a API com Supertest.',
        category: 'TECNICA',
        status: 'EM_ANDAMENTO',
        progress: 40,
        targetDate: '2027-03-31',
        managerFeedback: 'Ótimo avanço, inclua testes de RBAC.',
        managerFeedbackAt: '2026-11-20T15:00:00.000Z',
      }),
    ]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Metas de PDI' })).toBeInTheDocument();
    const article = await findArticle('Aprender testes de integração');
    expect(within(article).getByText('Técnica')).toBeInTheDocument();
    expect(within(article).getByText('Em andamento', NOT_OPTION)).toBeInTheDocument();
    expect(within(article).getByText('40%')).toBeInTheDocument();
    expect(within(article).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    expect(within(article).getByText(/31\/03\/2027/)).toBeInTheDocument();
    expect(within(article).getByText('Cobrir a API com Supertest.')).toBeInTheDocument();
    expect(within(article).getByText('Ótimo avanço, inclua testes de RBAC.')).toBeInTheDocument();
    expect(within(article).getByText(/20\/11\/2026/)).toBeInTheDocument();
  });

  it('[UI-36] filtro por status no cliente, refletido na URL e sem nova requisição', async () => {
    const { user } = setup(ALL_STATUSES);
    await findArticle('Meta em andamento');
    const requestsBefore = countRequests('GET', '/pd-goals');

    await user.selectOptions(screen.getByLabelText('Filtrar por status'), 'Em andamento');

    await waitFor(() => expect(currentPath()).toBe('/goals?status=EM_ANDAMENTO'));
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('article', { name: 'Meta em andamento' })).toBeInTheDocument();
    expect(countRequests('GET', '/pd-goals')).toBe(requestsBefore);
  });

  it('[UI-36] filtro aplicado a partir da URL', async () => {
    setup(ALL_STATUSES, '/goals?status=CONCLUIDA');

    expect(await findArticle('Meta concluída')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByLabelText('Filtrar por status')).toHaveValue('CONCLUIDA');
  });

  it('[UI-36] valor desconhecido na URL equivale a "Todas"', async () => {
    setup(ALL_STATUSES, '/goals?status=XYZ');

    await findArticle('Meta cancelada');
    expect(screen.getAllByRole('article')).toHaveLength(4);
    expect(screen.getByLabelText('Filtrar por status')).toHaveValue('');
  });

  it('[UI-37] sem metas: estado vazio com "Criar meta"', async () => {
    setup([]);

    expect(await screen.findByText('Você ainda não tem metas de PDI.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar meta' })).toBeInTheDocument();
  });

  it('[UI-37] filtro sem resultado: "Nenhuma meta com este status." sem a ação de criar', async () => {
    setup([makeGoal({ title: 'Meta não iniciada', status: 'NAO_INICIADA' })], '/goals?status=CANCELADA');

    expect(await screen.findByText('Nenhuma meta com este status.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Criar meta' })).not.toBeInTheDocument();
    expect(screen.queryByText('Você ainda não tem metas de PDI.')).not.toBeInTheDocument();
  });
});

describe('GoalsPage — criar e editar (spec 05 §6.4.2)', () => {
  it('[UI-38] cria meta válida: POST com os campos, diálogo fecha e a meta aparece; prazo com min = hoje UTC', async () => {
    const { user } = setup([]);
    await screen.findByText('Você ainda não tem metas de PDI.');

    await user.click(screen.getByRole('button', { name: 'Nova meta' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova meta' });
    expect(within(dialog).getByLabelText('Prazo')).toHaveAttribute('min', '2026-11-24');

    await user.type(within(dialog).getByLabelText('Título'), 'Conduzir uma retrospectiva');
    await user.selectOptions(within(dialog).getByLabelText('Categoria'), 'Comportamental');
    await user.type(within(dialog).getByLabelText('Prazo'), '2027-01-15');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await findArticle('Conduzir uma retrospectiva')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const body = (await lastBody('POST', '/pd-goals')) as Record<string, unknown>;
    expect(body).toMatchObject({ title: 'Conduzir uma retrospectiva', category: 'COMPORTAMENTAL', targetDate: '2027-01-15' });
    expect(body.description ?? null).toBeNull();
    expect(body).not.toHaveProperty('userId');
  });

  it('[UI-38] /goals?new=1 abre o diálogo de criação', async () => {
    setup([], '/goals?new=1');

    expect(await screen.findByRole('dialog', { name: 'Nova meta' })).toBeInTheDocument();
  });

  it('[UI-39] 400 com details de title e targetDate: erros nos campos, diálogo aberto e valores preservados', async () => {
    const { user } = setup([]);
    mockApi('post', '/pd-goals', () =>
      apiError(400, 'VALIDATION_ERROR', 'Dados inválidos.', [
        { field: 'title', message: 'Título deve ter entre 3 e 150 caracteres.' },
        { field: 'targetDate', message: 'Prazo não pode estar no passado.' },
      ]),
    );
    await screen.findByText('Você ainda não tem metas de PDI.');

    await user.click(screen.getByRole('button', { name: 'Nova meta' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova meta' });
    await user.type(within(dialog).getByLabelText('Título'), 'Meta X');
    await user.type(within(dialog).getByLabelText('Prazo'), '2027-01-15');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(within(dialog).getByLabelText('Título')).toHaveAccessibleDescription(
        expect.stringContaining('Título deve ter entre 3 e 150 caracteres.'),
      ),
    );
    expect(within(dialog).getByLabelText('Prazo')).toHaveAccessibleDescription(
      expect.stringContaining('Prazo não pode estar no passado.'),
    );
    expect(screen.getByRole('dialog', { name: 'Nova meta' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Título')).toHaveValue('Meta X');
  });

  it('[UI-44] dono edita o título: PATCH só com o campo alterado e card atualizado', async () => {
    const goal = makeGoal({ title: 'Título antigo', status: 'NAO_INICIADA' });
    const { user } = setup([goal]);

    await user.click(within(await findArticle('Título antigo')).getByRole('button', { name: 'Editar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar meta' });
    const title = within(dialog).getByLabelText('Título');
    expect(title).toHaveValue('Título antigo');
    await user.clear(title);
    await user.type(title, 'Título novo');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await findArticle('Título novo')).toBeInTheDocument();
    expect(await lastBody('PATCH', `/pd-goals/${goal.id}`)).toEqual({ title: 'Título novo' });
  });
});

describe('GoalsPage — progresso, status e exclusão (spec 05 §6.4.3–6.4.6)', () => {
  it('[UI-41] progresso 30 em NAO_INICIADA: envia { progress: 30 } e mostra o estado devolvido pela API', async () => {
    const goal = makeGoal({ title: 'Meta nova', status: 'NAO_INICIADA', progress: 0 });
    const { user } = setup([goal]);
    mockApi('patch', '/pd-goals/:id', () => ok({ goal: { ...goal, status: 'EM_ANDAMENTO', progress: 30 } }));

    const article = await findArticle('Meta nova');
    const progress = within(article).getByLabelText('Progresso (%)');
    await user.clear(progress);
    await user.type(progress, '30');
    await user.click(within(article).getByRole('button', { name: 'Salvar progresso' }));

    await waitFor(() => expect(within(screen.getByRole('article', { name: 'Meta nova' })).getByText('30%')).toBeInTheDocument());
    expect(within(screen.getByRole('article', { name: 'Meta nova' })).getByText('Em andamento', NOT_OPTION)).toBeInTheDocument();
    expect(await lastBody('PATCH', `/pd-goals/${goal.id}`)).toEqual({ progress: 30 });
  });

  it('[UI-42] em EM_ANDAMENTO não oferece "Não iniciada"; concluir pede confirmação e envia só { status }', async () => {
    const goal = makeGoal({ title: 'Meta em curso', status: 'EM_ANDAMENTO', progress: 40 });
    const { user } = setup([goal]);
    mockApi('patch', '/pd-goals/:id', () =>
      ok({ goal: { ...goal, status: 'CONCLUIDA', progress: 100, completedAt: '2026-11-24T15:00:00.000Z' } }),
    );

    const article = await findArticle('Meta em curso');
    const status = within(article).getByLabelText('Status');
    expect(within(status).queryByRole('option', { name: 'Não iniciada' })).not.toBeInTheDocument();
    expect(within(status).getByRole('option', { name: 'Concluída' })).toBeInTheDocument();
    expect(within(status).getByRole('option', { name: 'Cancelada' })).toBeInTheDocument();

    await user.selectOptions(status, 'Concluída');
    await user.click(within(article).getByRole('button', { name: 'Salvar progresso' }));
    expect(countRequests('PATCH', `/pd-goals/${goal.id}`)).toBe(0);

    const confirm = await screen.findByRole('dialog');
    await user.click(within(confirm).getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(countRequests('PATCH', `/pd-goals/${goal.id}`)).toBe(1));
    expect(await lastBody('PATCH', `/pd-goals/${goal.id}`)).toEqual({ status: 'CONCLUIDA' });
    expect(await within(screen.getByRole('article', { name: 'Meta em curso' })).findByText('Concluída', NOT_OPTION)).toBeInTheDocument();
  });

  it.each([
    ['CONCLUIDA', makeGoal({ title: 'Terminal', status: 'CONCLUIDA', progress: 100 })],
    ['CANCELADA', makeGoal({ title: 'Terminal', status: 'CANCELADA', progress: 20 })],
  ])('[UI-43] meta %s é somente leitura para o dono', async (_status, goal) => {
    setup([goal]);

    const article = await findArticle('Terminal');
    expect(within(article).queryByLabelText('Progresso (%)')).not.toBeInTheDocument();
    expect(within(article).queryByLabelText('Status')).not.toBeInTheDocument();
    expect(within(article).queryByRole('button', { name: 'Salvar progresso' })).not.toBeInTheDocument();
    expect(within(article).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(within(article).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
  });

  it('[UI-45] "Excluir" só em NAO_INICIADA; confirmação → DELETE → a meta some', async () => {
    const deletable = makeGoal({ title: 'Pode excluir', status: 'NAO_INICIADA' });
    const started = makeGoal({ title: 'Já iniciada', status: 'EM_ANDAMENTO', progress: 10 });
    const { user } = setup([deletable, started]);

    expect(within(await findArticle('Já iniciada')).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
    await user.click(within(await findArticle('Pode excluir')).getByRole('button', { name: 'Excluir' }));
    expect(countRequests('DELETE', `/pd-goals/${deletable.id}`)).toBe(0);

    const confirm = await screen.findByRole('dialog');
    await user.click(within(confirm).getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(screen.queryByRole('article', { name: 'Pode excluir' })).not.toBeInTheDocument());
    expect(countRequests('DELETE', `/pd-goals/${deletable.id}`)).toBe(1);
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('[UI-45] 409 GOAL_NOT_DELETABLE: alerta com a mensagem da API e lista recarregada', async () => {
    const goal = makeGoal({ title: 'Corrida', status: 'NAO_INICIADA' });
    const { user } = setup([goal]);
    const message =
      'Apenas metas não iniciadas podem ser excluídas. Para encerrar esta meta, altere o status para CANCELADA.';
    mockApi('delete', '/pd-goals/:id', () => apiError(409, 'GOAL_NOT_DELETABLE', message));

    await user.click(within(await findArticle('Corrida')).getByRole('button', { name: 'Excluir' }));
    const requestsBefore = countRequests('GET', '/pd-goals');
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    await waitFor(() => expect(countRequests('GET', '/pd-goals')).toBeGreaterThan(requestsBefore));
  });

  it('[UI-48] dono vê o parecer somente leitura, sem formulário de parecer', async () => {
    setup([
      makeGoal({
        title: 'Com parecer',
        status: 'EM_ANDAMENTO',
        progress: 50,
        managerFeedback: 'Continue assim.',
        managerFeedbackAt: '2026-11-20T15:00:00.000Z',
      }),
    ]);

    const article = await findArticle('Com parecer');
    expect(within(article).getByText('Continue assim.')).toBeInTheDocument();
    expect(within(article).queryByLabelText('Parecer do gestor')).not.toBeInTheDocument();
    expect(within(article).queryByRole('button', { name: 'Salvar parecer' })).not.toBeInTheDocument();
    expect(within(article).queryByRole('button', { name: 'Remover parecer' })).not.toBeInTheDocument();
  });

  it('[UI-49] 409 GOAL_LOCKED no PATCH: alerta com a mensagem da API e refetch da lista', async () => {
    const goal = makeGoal({ title: 'Desatualizada', status: 'EM_ANDAMENTO', progress: 10 });
    const { user } = setup([goal]);
    mockApi('patch', '/pd-goals/:id', () =>
      apiError(409, 'GOAL_LOCKED', 'Metas concluídas ou canceladas não podem ser alteradas.'),
    );

    const article = await findArticle('Desatualizada');
    const requestsBefore = countRequests('GET', '/pd-goals');
    const progress = within(article).getByLabelText('Progresso (%)');
    await user.clear(progress);
    await user.type(progress, '50');
    await user.click(within(article).getByRole('button', { name: 'Salvar progresso' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Metas concluídas ou canceladas não podem ser alteradas.');
    await waitFor(() => expect(countRequests('GET', '/pd-goals')).toBeGreaterThan(requestsBefore));
  });
});
