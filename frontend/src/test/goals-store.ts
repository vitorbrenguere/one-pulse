import type { GoalDTO } from '../types/api';
import { makeGoal } from './factories';
import { mockApi, noContent, ok } from './server';

export interface GoalsStore {
  readonly goals: GoalDTO[];
}

/**
 * API de metas em memória: GET (próprias ou `?userId=`), POST, PATCH (mescla o corpo) e DELETE.
 * Regras derivadas do servidor (PRG-02/03 etc.) NÃO são simuladas: testes que dependem delas
 * sobrescrevem a rota com `mockApi`, deixando explícito o que a API devolveu.
 */
export function mockGoalsStore(viewerId: number, initial: GoalDTO[]): GoalsStore {
  const store = { goals: [...initial] };

  mockApi('get', '/pd-goals', ({ url }) => {
    const userId = Number(url.searchParams.get('userId') ?? viewerId);
    return ok({ goals: store.goals.filter((g) => g.userId === userId) });
  });

  mockApi('post', '/pd-goals', async ({ request }) => {
    const body = (await request.json()) as Partial<GoalDTO>;
    const goal = makeGoal({ ...body, userId: body.userId ?? viewerId, createdBy: viewerId });
    store.goals.push(goal);
    return ok({ goal }, 201);
  });

  mockApi('patch', '/pd-goals/:id', async ({ request, params }) => {
    const body = (await request.json()) as Partial<GoalDTO>;
    const index = store.goals.findIndex((g) => String(g.id) === params.id);
    const current = store.goals[index];
    if (!current) throw new Error(`Meta ${String(params.id)} não está no store do teste`);
    const updated: GoalDTO = { ...current, ...body };
    if ('managerFeedback' in body) {
      updated.managerFeedbackAt = body.managerFeedback === null ? null : '2026-11-24T15:00:00.000Z';
    }
    store.goals[index] = updated;
    return ok({ goal: updated });
  });

  mockApi('delete', '/pd-goals/:id', ({ params }) => {
    store.goals = store.goals.filter((g) => String(g.id) !== params.id);
    return noContent();
  });

  return {
    get goals() {
      return store.goals;
    },
  };
}
