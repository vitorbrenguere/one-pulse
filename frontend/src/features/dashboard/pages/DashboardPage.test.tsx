import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { C1, G, L1, L2, makeEvaluation, makeGoal } from '../../../test/factories';
import { listItemWith, mockManagerData, mockOwnData, renderApp, freezeDate } from '../../../test/render';
import { apiError, countRequests, mockApi, ok, requestsTo } from '../../../test/server';

const SENT = '2026-11-20T10:00:00.000Z';

/** Contagem exibida para um status no resumo (`<dt>rótulo</dt><dd>n</dd>`). */
function statusCount(region: HTMLElement, label: string): string | null {
  const term = within(region)
    .getAllByRole('term')
    .find((dt) => dt.textContent?.trim() === label);
  if (!term) throw new Error(`Status "${label}" não encontrado no resumo`);
  return term.nextElementSibling?.textContent?.trim() ?? null;
}

async function findRegion(name: string): Promise<HTMLElement> {
  return screen.findByRole('region', { name });
}

describe('Dashboard do COLABORADOR (spec 05 §6.2)', () => {
  it('[UI-25] resumo das metas: contagem por status, até 5 ativas, barra de progresso e "Atrasada"', async () => {
    freezeDate('2026-11-24T15:00:00.000Z');
    const active = [
      makeGoal({ title: 'Ativa vencida', status: 'EM_ANDAMENTO', progress: 40, targetDate: '2026-11-01' }),
      makeGoal({ title: 'Ativa 2', status: 'NAO_INICIADA', targetDate: '2026-12-10' }),
      makeGoal({ title: 'Ativa 3', status: 'EM_ANDAMENTO', progress: 10, targetDate: '2027-01-10' }),
      makeGoal({ title: 'Ativa 4', status: 'EM_ANDAMENTO', progress: 70, targetDate: '2027-02-10' }),
      makeGoal({ title: 'Ativa 5', status: 'NAO_INICIADA', targetDate: '2027-03-10' }),
      makeGoal({ title: 'Ativa 6', status: 'EM_ANDAMENTO', progress: 20, targetDate: '2027-04-10' }),
    ];
    const finished = [
      makeGoal({ title: 'Concluída antiga', status: 'CONCLUIDA', progress: 100, targetDate: '2026-10-01' }),
      makeGoal({ title: 'Cancelada antiga', status: 'CANCELADA', progress: 30, targetDate: '2026-10-02' }),
    ];
    mockOwnData({ goals: [...finished, ...active] });

    renderApp({ route: '/dashboard', me: C1 });

    const region = await findRegion('Minhas metas');
    await within(region).findByText('Ativa vencida');
    expect(statusCount(region, 'Não iniciada')).toBe('2');
    expect(statusCount(region, 'Em andamento')).toBe('4');
    expect(statusCount(region, 'Concluída')).toBe('1');
    expect(statusCount(region, 'Cancelada')).toBe('1');

    const list = within(region).getByRole('list', { name: 'Metas ativas' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Ativa vencida'),
      expect.stringContaining('Ativa 2'),
      expect.stringContaining('Ativa 3'),
      expect.stringContaining('Ativa 4'),
      expect.stringContaining('Ativa 5'),
    ]);
    expect(within(list).queryByText('Concluída antiga')).not.toBeInTheDocument();

    const overdue = listItemWith(list, 'Ativa vencida');
    expect(within(overdue).getByText('Atrasada')).toBeInTheDocument();
    expect(within(overdue).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
    expect(within(listItemWith(list, 'Ativa 2')).queryByText('Atrasada')).not.toBeInTheDocument();
    expect(within(region).getByRole('link', { name: 'Ver todas' })).toHaveAttribute('href', '/goals');

    expect(screen.queryByRole('region', { name: 'Minha equipe' })).not.toBeInTheDocument();
    expect(countRequests('GET', '/users/team')).toBe(0);
  });

  it('[UI-26] sem metas e sem avaliações: estados vazios com as ações corretas', async () => {
    mockOwnData();

    renderApp({ route: '/dashboard', me: C1 });

    const goals = await findRegion('Minhas metas');
    expect(await within(goals).findByRole('link', { name: 'Criar primeira meta' })).toHaveAttribute(
      'href',
      '/goals?new=1',
    );
    const evaluations = await findRegion('Minhas avaliações');
    expect(
      await within(evaluations).findByText('Nenhuma avaliação aberta. O ciclo é aberto pelo seu gestor.'),
    ).toBeInTheDocument();
  });

  it('[UI-27] cada avaliação mostra o ciclo e o estado visual da §6.5.1', async () => {
    mockOwnData({
      evaluations: [
        makeEvaluation({ cycle: '2026-S2' }),
        makeEvaluation({ cycle: '2026-S1', selfSubmittedAt: SENT }),
        makeEvaluation({
          cycle: '2025-S2',
          status: 'CONCLUIDA',
          selfScore: 4,
          selfSubmittedAt: SENT,
          managerScore: 3,
          managerFeedback: 'Bom.',
          managerSubmittedAt: SENT,
        }),
      ],
    });

    renderApp({ route: '/dashboard', me: C1 });

    const region = await findRegion('Minhas avaliações');
    await within(region).findByText('2º semestre de 2026'); // aguarda a lista carregar
    expect(within(listItemWith(region, '2º semestre de 2026')).getByText('Autoavaliação pendente')).toBeInTheDocument();
    expect(within(listItemWith(region, '1º semestre de 2026')).getByText('Aguardando gestor')).toBeInTheDocument();
    expect(
      within(listItemWith(region, '2º semestre de 2025')).getByText('Concluída · notas reveladas'),
    ).toBeInTheDocument();
  });
});

describe('Dashboard do GESTOR (spec 05 §6.2)', () => {
  it('[UI-28] equipe com links para /team/:id e badge "Avaliação pendente" só para quem tem a parte do gestor pendente', async () => {
    mockManagerData({
      team: [L2, L1],
      teamEvaluations: [
        makeEvaluation({ userId: L1.id, managerId: G.id, managerSubmittedAt: null }),
        makeEvaluation({ userId: L2.id, managerId: G.id, managerSubmittedAt: SENT }),
      ],
    });

    renderApp({ route: '/dashboard', me: G });

    const region = await findRegion('Minha equipe');
    expect(await within(region).findByRole('link', { name: /Camila Rocha/ })).toHaveAttribute('href', `/team/${L1.id}`);
    expect(within(region).getByRole('link', { name: /Bruno Costa/ })).toHaveAttribute('href', `/team/${L2.id}`);

    expect(within(listItemWith(region, 'Camila Rocha')).getByText('Avaliação pendente')).toBeInTheDocument();
    expect(within(listItemWith(region, 'Bruno Costa')).queryByText('Avaliação pendente')).not.toBeInTheDocument();
    expect(within(listItemWith(region, 'Camila Rocha')).getByText(L1.jobTitle ?? '')).toBeInTheDocument();

    // D-07: o dashboard do gestor não carrega metas por liderado (só as próprias, sem userId).
    expect(requestsTo('GET', '/pd-goals').filter((r) => r.searchParams.has('userId'))).toHaveLength(0);
    expect(countRequests('GET', '/evaluations')).toBeGreaterThanOrEqual(1);
  });

  it('[UI-29] equipe vazia: "Você ainda não tem liderados diretos."', async () => {
    mockManagerData({ team: [] });

    renderApp({ route: '/dashboard', me: G });

    const region = await findRegion('Minha equipe');
    expect(await within(region).findByText('Você ainda não tem liderados diretos.')).toBeInTheDocument();
  });

  it('[UI-29] erro 500 na equipe: alerta com "Tentar novamente", que refaz a requisição e mostra a equipe', async () => {
    mockManagerData({ team: [L1] });
    let available = false;
    mockApi('get', '/users/team', () =>
      available ? ok({ users: [L1] }) : apiError(500, 'INTERNAL_ERROR', 'Erro inesperado no servidor.'),
    );

    const { user } = renderApp({ route: '/dashboard', me: G });

    const region = await findRegion('Minha equipe');
    expect(await within(region).findByRole('alert')).toHaveTextContent('Erro inesperado no servidor.');
    const callsBeforeRetry = countRequests('GET', '/users/team');

    available = true;
    await user.click(within(region).getByRole('button', { name: 'Tentar novamente' }));

    expect(await within(region).findByRole('link', { name: /Camila Rocha/ })).toBeInTheDocument();
    expect(countRequests('GET', '/users/team')).toBe(callsBeforeRetry + 1);
    expect(within(region).queryByRole('alert')).not.toBeInTheDocument();
  });
});
