import type { Request, RequestHandler, Response } from 'express';
import { viewerOf } from '../../shared/http/viewer-of.js';
import type { CreateGoalInput, GoalIdParam, ListGoalsQuery, UpdateGoalInput } from './pd-goals.schemas.js';
import type { PdGoalsService } from './pd-goals.service.js';

/** Camada HTTP apenas: lê a requisição (já validada), delega ao service e monta a resposta. */
export function createPdGoalsController(deps: { pdGoalsService: PdGoalsService }) {
  const { pdGoalsService } = deps;

  const create: RequestHandler<Record<string, string>, unknown, CreateGoalInput> = async (req, res) => {
    const goal = await pdGoalsService.createGoal(viewerOf(req), req.body);
    res.status(201).json({ goal });
  };

  const list = async (query: ListGoalsQuery, req: Request, res: Response): Promise<void> => {
    const goals = await pdGoalsService.listGoals(viewerOf(req), query);
    res.status(200).json({ goals });
  };

  const getById = async ({ id }: GoalIdParam, req: Request, res: Response): Promise<void> => {
    const goal = await pdGoalsService.getGoal(viewerOf(req), id);
    res.status(200).json({ goal });
  };

  /** `req.body` já passou pelo validateBody(updateGoalSchema) na rota. */
  const update = async ({ id }: GoalIdParam, req: Request, res: Response): Promise<void> => {
    const input: UpdateGoalInput = req.body;
    const goal = await pdGoalsService.updateGoal(viewerOf(req), id, input);
    res.status(200).json({ goal });
  };

  const remove = async ({ id }: GoalIdParam, req: Request, res: Response): Promise<void> => {
    await pdGoalsService.deleteGoal(viewerOf(req), id);
    res.status(204).end();
  };

  return { create, list, getById, update, remove };
}
