import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GoalDTO } from '../../../types/api';
import { G, L1, L2, makeEvaluation, makeGoal } from '../../../test/factories';
import { mockGoalsStore } from '../../../test/goals-store';
import { mockManagerData, renderApp, freezeDate } from '../../../test/render';
import { apiError, countRequests, lastBody, mockApi, ok, requestsTo } from '../../../test/server';

const NOT_FOUND_USER = () => apiError(404, 'NOT_FOUND', 'Usuário não encontrado.');

function mockMember(goals: GoalDTO[] = []) {
  mockManagerData({
    team: [L1, L2],
    teamEvaluations: [makeEvaluation({ userId: L1.id, managerId: G.id, cycle: '2026-S2' })],
  });
  mockApi('get', '/users/:id', ({ params }) => (params.id === String(L1.id) ? ok({ user: L1 }) : NOT_FOUND_USER()));
  return mockGoalsStore(G.id, goals);
}

async function renderMember() {
  const view = renderApp({ route: `/team/${L1.id}`, me: G });
  await screen.findByRole('heading', { level: 1, name: L1.name });
  return view;
}

function goalArticle(title: string): HTMLElement {
  return screen.getByRole('article', { name: title });
}

describe('TeamMemberPage (spec 05 §6.3)', () => {
  it('[UI-33] mostra perfil, metas e avaliações do liderado, consultando com userId', async () => {
    mockMember([makeGoal({ userId: L1.id, title: 'Liderar uma retrospectiva' })]);

    await renderMember();

    expect(screen.getByText(L1.jobTitle ?? '')).toBeInTheDocument();
    const goals = screen.getByRole('region', { name: 'Metas' });
    expect(await within(goals).findByText('Liderar uma retrospectiva')).toBeInTheDocument();
    const evaluations = screen.getByRole('region', { name: 'Avaliações' });
    expect(await within(evaluations).findByText(/2º semestre de 2026/)).toBeInTheDocument();

    expect(countRequests('GET', `/users/${L1.id}`)).toBe(1);
    expect(requestsTo('GET', '/pd-goals').map((r) => r.searchParams.get('userId'))).toContain(String(L1.id));
    expect(requestsTo('GET', '/evaluations').map((r) => r.searchParams.get('userId'))).toContain(String(L1.id));
  });

  it.each([
    ['API responde 404 (fora da equipe ou inexistente)', '/team/999', true],
    ['id mal formado', '/team/abc', false],
  ])('[UI-34] %s: "Colaborador não encontrado" com link para o dashboard', async (_case, route, callsApi) => {
    mockMember();
    mockApi('get', '/pd-goals', () => NOT_FOUND_USER());
    mockApi('get', '/evaluations', () => NOT_FOUND_USER());

    renderApp({ route, me: G });

    expect(await screen.findByRole('heading', { level: 1, name: 'Colaborador não encontrado' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar ao dashboard' })).toHaveAttribute('href', '/dashboard');
    if (callsApi) {
      expect(countRequests('GET', '/users/999')).toBe(1);
    } else {
      expect(countRequests('GET', '/users/abc')).toBe(0);
      expect(requestsTo('GET', '/pd-goals').filter((r) => r.searchParams.has('userId'))).toHaveLength(0);
    }
  });

  it('[UI-40] "Nova meta para <nome>" cria a meta com userId do liderado', async () => {
    freezeDate();
    const store = mockMember();
    const { user } = await renderMember();

    await user.click(screen.getByRole('button', { name: `Nova meta para ${L1.name}` }));
    const dialog = await screen.findByRole('dialog', { name: 'Nova meta' });
    await user.type(within(dialog).getByLabelText('Título'), 'Conduzir uma retrospectiva');
    await user.selectOptions(within(dialog).getByLabelText('Categoria'), 'Comportamental');
    await user.type(within(dialog).getByLabelText('Prazo'), '2027-01-15');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await lastBody('POST', '/pd-goals')).toMatchObject({
      userId: L1.id,
      title: 'Conduzir uma retrospectiva',
      category: 'COMPORTAMENTAL',
      targetDate: '2027-01-15',
    });
    expect(store.goals).toHaveLength(1);
    expect(await screen.findByRole('article', { name: 'Conduzir uma retrospectiva' })).toBeInTheDocument();
  });

  it.each([
    ['EM_ANDAMENTO', makeGoal({ userId: L1.id, title: 'Meta em andamento', status: 'EM_ANDAMENTO', progress: 40 })],
    ['CONCLUIDA', makeGoal({ userId: L1.id, title: 'Meta concluída', status: 'CONCLUIDA', progress: 100 })],
  ])('[UI-46] meta %s do liderado: sem controles do dono, com formulário de parecer', async (_status, goal) => {
    mockMember([goal]);
    await renderMember();

    const article = await screen.findByRole('article', { name: goal.title });
    expect(within(article).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument();
    expect(within(article).queryByRole('button', { name: 'Excluir' })).not.toBeInTheDocument();
    expect(within(article).queryByLabelText('Progresso (%)')).not.toBeInTheDocument();
    expect(within(article).queryByLabelText('Status')).not.toBeInTheDocument();
    expect(within(article).queryByRole('button', { name: 'Salvar progresso' })).not.toBeInTheDocument();
    expect(within(article).getByLabelText('Parecer do gestor')).toBeInTheDocument();
    expect(within(article).getByRole('button', { name: 'Salvar parecer' })).toBeInTheDocument();
  });

  it('[UI-47] parecer: salvar envia o texto; remover pede confirmação e envia null', async () => {
    const goal = makeGoal({ userId: L1.id, title: 'Aprender testes', status: 'EM_ANDAMENTO', progress: 40 });
    mockMember([goal]);
    const { user } = await renderMember();

    let article = await screen.findByRole('article', { name: goal.title });
    await user.type(within(article).getByLabelText('Parecer do gestor'), 'Ótimo avanço.');
    await user.click(within(article).getByRole('button', { name: 'Salvar parecer' }));

    article = goalArticle(goal.title);
    expect(await within(article).findByText('Ótimo avanço.')).toBeInTheDocument();
    expect(await lastBody('PATCH', `/pd-goals/${goal.id}`)).toEqual({ managerFeedback: 'Ótimo avanço.' });

    await user.click(within(article).getByRole('button', { name: 'Remover parecer' }));
    const confirm = await screen.findByRole('dialog');
    await user.click(within(confirm).getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(within(goalArticle(goal.title)).queryByText('Ótimo avanço.')).not.toBeInTheDocument());
    expect(await lastBody('PATCH', `/pd-goals/${goal.id}`)).toEqual({ managerFeedback: null });
  });

  it('[UI-47] parecer vazio ou só com espaços: erro no campo e nenhuma requisição', async () => {
    const goal = makeGoal({ userId: L1.id, title: 'Aprender testes', status: 'EM_ANDAMENTO', progress: 40 });
    mockMember([goal]);
    const { user } = await renderMember();

    const article = await screen.findByRole('article', { name: goal.title });
    await user.type(within(article).getByLabelText('Parecer do gestor'), '   ');
    await user.click(within(article).getByRole('button', { name: 'Salvar parecer' }));

    expect(within(article).getByLabelText('Parecer do gestor')).toHaveAttribute('aria-invalid', 'true');
    expect(within(article).getByLabelText('Parecer do gestor')).toHaveAccessibleDescription(/.+/);
    expect(countRequests('PATCH', `/pd-goals/${goal.id}`)).toBe(0);
  });
});
