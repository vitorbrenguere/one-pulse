import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EvaluationDTO } from '../../../types/api';
import { C1, G, L1, L2, makeEvaluation } from '../../../test/factories';
import { mockManagerData, renderApp, freezeDate } from '../../../test/render';
import { apiError, countRequests, lastBody, mockApi, ok } from '../../../test/server';

const SENT = '2026-11-20T10:00:00.000Z';
const CYCLE_LABEL = '2º semestre de 2026';
const TEAM_ARTICLE = new RegExp(`${L1.name}.*${CYCLE_LABEL}`);

/** GET /evaluations do C1 com estado; PATCH devolve `respond(body)` e atualiza a lista. */
function mockCollaboratorEvaluations(initial: EvaluationDTO[], respond?: (body: Record<string, unknown>) => EvaluationDTO) {
  let current = [...initial];
  mockApi('get', '/pd-goals', () => ok({ goals: [] }));
  mockApi('get', '/evaluations', () => ok({ evaluations: current }));
  if (respond) {
    mockApi('patch', '/evaluations/:id', async ({ request }) => {
      const updated = respond((await request.json()) as Record<string, unknown>);
      current = current.map((e) => (e.id === updated.id ? updated : e));
      return ok({ evaluation: updated });
    });
  }
}

async function renderEvaluations(me = C1) {
  const view = renderApp({ route: '/evaluations', me });
  await screen.findByRole('heading', { level: 1, name: 'Avaliações de desempenho' });
  return view;
}

describe('EvaluationsPage — COLABORADOR (spec 05 §6.5)', () => {
  it('[UI-51] lista as próprias avaliações com ciclo e estado visual, sem "Abrir avaliação"', async () => {
    mockCollaboratorEvaluations([makeEvaluation({ cycle: '2026-S2' })]);

    await renderEvaluations();

    const article = await screen.findByRole('article', { name: CYCLE_LABEL });
    expect(within(article).getByText('Autoavaliação pendente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abrir avaliação' })).not.toBeInTheDocument();
    expect(countRequests('GET', '/users/team')).toBe(0);
  });

  it('[UI-51] sem avaliações: mensagem explicando que o ciclo é aberto pelo gestor', async () => {
    mockCollaboratorEvaluations([]);

    await renderEvaluations();

    expect(await screen.findByText('Nenhuma avaliação aberta. O ciclo é aberto pelo seu gestor.')).toBeInTheDocument();
  });

  it('[UI-54] salvar rascunho envia nota e comentários sem submit e mantém a parte editável', async () => {
    const evaluation = makeEvaluation();
    mockCollaboratorEvaluations([evaluation], (body) => ({ ...evaluation, ...body }));
    const { user } = await renderEvaluations();

    const article = await screen.findByRole('article', { name: CYCLE_LABEL });
    await user.click(within(article).getByRole('button', { name: 'Preencher autoavaliação' }));
    await user.click(within(article).getByRole('radio', { name: /^4/ }));
    await user.type(within(article).getByLabelText('Comentários'), 'Entreguei a API.');
    await user.click(within(article).getByRole('button', { name: 'Salvar rascunho' }));

    await waitFor(() => expect(countRequests('PATCH', `/evaluations/${evaluation.id}`)).toBe(1));
    expect(await lastBody('PATCH', `/evaluations/${evaluation.id}`)).toEqual({
      selfScore: 4,
      selfComments: 'Entreguei a API.',
    });
    const updated = screen.getByRole('article', { name: CYCLE_LABEL });
    expect(within(updated).getByRole('radio', { name: /^4/ })).toBeChecked();
    expect(within(updated).getByRole('radio', { name: /^4/ })).toBeEnabled();
    expect(within(updated).getByRole('button', { name: 'Enviar' })).toBeInTheDocument();
  });

  it('[UI-55] "Enviar" sem nota bloqueia no cliente; com nota, confirma e envia com submit: true', async () => {
    const evaluation = makeEvaluation();
    mockCollaboratorEvaluations([evaluation], (body) => ({
      ...evaluation,
      selfScore: Number(body.selfScore),
      selfSubmittedAt: '2026-11-24T15:00:00.000Z',
    }));
    const { user } = await renderEvaluations();

    const article = await screen.findByRole('article', { name: CYCLE_LABEL });
    await user.click(within(article).getByRole('button', { name: 'Preencher autoavaliação' }));
    await user.click(within(article).getByRole('button', { name: 'Enviar' }));

    expect(await within(article).findByText('Informe a nota antes de enviar.')).toBeInTheDocument();
    expect(countRequests('PATCH', `/evaluations/${evaluation.id}`)).toBe(0);

    await user.click(within(article).getByRole('radio', { name: /^3/ }));
    await user.click(within(article).getByRole('button', { name: 'Enviar' }));
    const confirm = await screen.findByRole('dialog');
    expect(confirm).toHaveTextContent('Depois de enviada, sua parte não poderá ser alterada.');
    await user.click(within(confirm).getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(countRequests('PATCH', `/evaluations/${evaluation.id}`)).toBe(1));
    expect(await lastBody('PATCH', `/evaluations/${evaluation.id}`)).toMatchObject({ selfScore: 3, submit: true });
    const updated = screen.getByRole('article', { name: CYCLE_LABEL });
    expect(await within(updated).findByText('Aguardando gestor')).toBeInTheDocument();
    expect(within(updated).queryByRole('button', { name: 'Enviar' })).not.toBeInTheDocument();
    expect(within(updated).queryByRole('button', { name: 'Salvar rascunho' })).not.toBeInTheDocument();
  });

  it('[UI-56] gestor já enviou com ABERTA: avisa que será revelada e não renderiza nota/feedback ocultos', async () => {
    mockCollaboratorEvaluations([makeEvaluation({ managerSubmittedAt: SENT })]);

    await renderEvaluations();

    const article = await screen.findByRole('article', { name: CYCLE_LABEL });
    expect(within(article).getByText('Autoavaliação pendente · gestor já enviou')).toBeInTheDocument();
    expect(within(article).getByText(/Será revelada quando a avaliação for concluída\./)).toBeInTheDocument();
    expect(within(article).queryByText(/\d de 5/)).not.toBeInTheDocument();
    expect(within(article).queryByText(/^0$/)).not.toBeInTheDocument();
    expect(within(article).queryByText('Nota do gestor')).not.toBeInTheDocument();
  });

  it('[UI-57] o envio que conclui revela as duas partes, somente leitura', async () => {
    const evaluation = makeEvaluation({ selfScore: 4, selfComments: 'Entreguei a API.', managerSubmittedAt: SENT });
    mockCollaboratorEvaluations([evaluation], () => ({
      ...evaluation,
      status: 'CONCLUIDA',
      selfSubmittedAt: '2026-11-24T15:00:00.000Z',
      managerScore: 3,
      managerFeedback: 'Bom ritmo; aprofunde testes.',
    }));
    const { user } = await renderEvaluations();

    const article = await screen.findByRole('article', { name: CYCLE_LABEL });
    await user.click(within(article).getByRole('button', { name: 'Preencher autoavaliação' }));
    await user.click(within(article).getByRole('button', { name: 'Enviar' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar' }));

    const concluded = screen.getByRole('article', { name: CYCLE_LABEL });
    expect(await within(concluded).findByText('Concluída · notas reveladas')).toBeInTheDocument();
    expect(within(concluded).getByText('Nota do gestor')).toBeInTheDocument();
    expect(within(concluded).getByText('3 de 5')).toBeInTheDocument();
    expect(within(concluded).getByText('4 de 5')).toBeInTheDocument();
    expect(within(concluded).getByText('Bom ritmo; aprofunde testes.')).toBeInTheDocument();
    expect(within(concluded).getByText('Entreguei a API.')).toBeInTheDocument();
    expect(within(concluded).queryByRole('radio')).not.toBeInTheDocument();
    expect(within(concluded).queryByRole('button', { name: 'Enviar' })).not.toBeInTheDocument();
  });

  it('[UI-61] 409 EVALUATION_LOCKED: alerta com a mensagem da API e refetch', async () => {
    const evaluation = makeEvaluation({ selfScore: 4 });
    mockCollaboratorEvaluations([evaluation]);
    mockApi('patch', '/evaluations/:id', () =>
      apiError(409, 'EVALUATION_LOCKED', 'Esta parte da avaliação já foi enviada e não pode ser alterada.'),
    );
    const { user } = await renderEvaluations();

    const article = await screen.findByRole('article', { name: CYCLE_LABEL });
    await user.click(within(article).getByRole('button', { name: 'Preencher autoavaliação' }));
    const requestsBefore = countRequests('GET', '/evaluations');
    await user.click(within(article).getByRole('button', { name: 'Salvar rascunho' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta parte da avaliação já foi enviada e não pode ser alterada.',
    );
    await waitFor(() => expect(countRequests('GET', '/evaluations')).toBeGreaterThan(requestsBefore));
  });
});

describe('EvaluationsPage — GESTOR (spec 05 §6.5)', () => {
  it('[UI-52] seções "Avaliações da equipe" (com nomes) e "Minhas avaliações", com "Abrir avaliação"', async () => {
    mockManagerData({
      team: [L1, L2],
      teamEvaluations: [makeEvaluation({ userId: L1.id, managerId: G.id })],
      ownEvaluations: [makeEvaluation({ userId: G.id, managerId: 50, cycle: '2026-S1' })],
    });

    await renderEvaluations(G);

    const team = await screen.findByRole('region', { name: 'Avaliações da equipe' });
    expect(await within(team).findByRole('article', { name: TEAM_ARTICLE })).toBeInTheDocument();
    const own = screen.getByRole('region', { name: 'Minhas avaliações' });
    expect(await within(own).findByRole('article', { name: '1º semestre de 2026' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abrir avaliação' })).toBeInTheDocument();
  });

  it('[UI-53] abre avaliação para L1 no ciclo atual (opções: anterior, atual e próximo)', async () => {
    freezeDate('2026-11-24T15:00:00.000Z');
    mockManagerData({ team: [L1, L2] });
    let created: EvaluationDTO | null = null;
    mockApi('get', '/evaluations', ({ url }) =>
      ok({ evaluations: !url.searchParams.has('userId') && created ? [created] : [] }),
    );
    mockApi('post', '/evaluations', async ({ request }) => {
      const body = (await request.json()) as { userId: number; cycle: string };
      created = makeEvaluation({ userId: body.userId, managerId: G.id, cycle: body.cycle });
      return ok({ evaluation: created }, 201);
    });
    const { user } = await renderEvaluations(G);

    await user.click(screen.getByRole('button', { name: 'Abrir avaliação' }));
    const dialog = await screen.findByRole('dialog', { name: 'Abrir avaliação' });
    const cycle = within(dialog).getByLabelText('Ciclo');
    expect(cycle).toHaveValue('2026-S2');
    expect(within(cycle).getAllByRole('option').map((o) => o.getAttribute('value'))).toEqual([
      '2026-S1',
      '2026-S2',
      '2027-S1',
    ]);
    await user.selectOptions(within(dialog).getByLabelText('Colaborador'), L1.name);
    await user.click(within(dialog).getByRole('button', { name: 'Abrir avaliação' }));

    const team = screen.getByRole('region', { name: 'Avaliações da equipe' });
    expect(await within(team).findByRole('article', { name: TEAM_ARTICLE })).toBeInTheDocument();
    expect(await lastBody('POST', '/evaluations')).toEqual({ userId: L1.id, cycle: '2026-S2' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('[UI-53] 409 EVALUATION_ALREADY_EXISTS: mensagem da API dentro do diálogo', async () => {
    mockManagerData({ team: [L1] });
    mockApi('post', '/evaluations', () =>
      apiError(409, 'EVALUATION_ALREADY_EXISTS', 'Já existe uma avaliação deste colaborador para o ciclo informado.'),
    );
    const { user } = await renderEvaluations(G);

    await user.click(screen.getByRole('button', { name: 'Abrir avaliação' }));
    const dialog = await screen.findByRole('dialog', { name: 'Abrir avaliação' });
    await user.selectOptions(within(dialog).getByLabelText('Colaborador'), L1.name);
    await user.click(within(dialog).getByRole('button', { name: 'Abrir avaliação' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Já existe uma avaliação deste colaborador para o ciclo informado.',
    );
  });

  it('[UI-58] autoavaliação em rascunho fica oculta ao gestor; formulário do gestor com nota e feedback', async () => {
    mockManagerData({ team: [L1], teamEvaluations: [makeEvaluation({ userId: L1.id, managerId: G.id })] });
    const { user } = await renderEvaluations(G);

    const article = await screen.findByRole('article', { name: TEAM_ARTICLE });
    expect(within(article).getByText('Sua avaliação pendente')).toBeInTheDocument();
    await user.click(within(article).getByRole('button', { name: 'Avaliar' }));

    expect(within(article).getByText('A autoavaliação ainda não foi enviada.')).toBeInTheDocument();
    expect(within(article).getByRole('radiogroup', { name: 'Nota' })).toBeInTheDocument();
    expect(within(article).getByLabelText('Feedback')).toBeInTheDocument();
    expect(within(article).queryByLabelText('Comentários')).not.toBeInTheDocument();
  });

  it('[UI-59] gestor sem feedback não envia; com nota e feedback, confirma e envia com submit: true', async () => {
    const evaluation = makeEvaluation({ userId: L1.id, managerId: G.id });
    mockManagerData({ team: [L1], teamEvaluations: [evaluation] });
    mockApi('patch', '/evaluations/:id', () =>
      ok({ evaluation: { ...evaluation, managerScore: 3, managerFeedback: 'Bom ritmo.', managerSubmittedAt: SENT } }),
    );
    const { user } = await renderEvaluations(G);

    const article = await screen.findByRole('article', { name: TEAM_ARTICLE });
    await user.click(within(article).getByRole('button', { name: 'Avaliar' }));
    await user.click(within(article).getByRole('radio', { name: /^3/ }));
    await user.click(within(article).getByRole('button', { name: 'Enviar' }));

    expect(await within(article).findByText('Informe o feedback antes de enviar.')).toBeInTheDocument();
    expect(countRequests('PATCH', `/evaluations/${evaluation.id}`)).toBe(0);

    await user.type(within(article).getByLabelText('Feedback'), 'Bom ritmo.');
    await user.click(within(article).getByRole('button', { name: 'Enviar' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => expect(countRequests('PATCH', `/evaluations/${evaluation.id}`)).toBe(1));
    expect(await lastBody('PATCH', `/evaluations/${evaluation.id}`)).toMatchObject({
      managerScore: 3,
      managerFeedback: 'Bom ritmo.',
      submit: true,
    });
  });

  it('[UI-60] gestor avaliado: na própria avaliação vê o formulário de autoavaliação e "Seu gestor"', async () => {
    mockManagerData({
      team: [L1],
      ownEvaluations: [makeEvaluation({ userId: G.id, managerId: 50, cycle: '2026-S2' })],
    });
    const { user } = await renderEvaluations(G);

    const own = await screen.findByRole('region', { name: 'Minhas avaliações' });
    const article = await within(own).findByRole('article', { name: CYCLE_LABEL });
    expect(within(article).getByText(/Seu gestor/)).toBeInTheDocument();
    await user.click(within(article).getByRole('button', { name: 'Preencher autoavaliação' }));

    expect(within(article).getByLabelText('Comentários')).toBeInTheDocument();
    expect(within(article).queryByLabelText('Feedback')).not.toBeInTheDocument();
  });
});
