import type { Request, RequestHandler, Response } from 'express';
import { viewerOf } from '../../shared/http/viewer-of.js';
import type {
  CreateEvaluationInput,
  EvaluationIdParam,
  ListEvaluationsQuery,
  UpdateEvaluationInput,
} from './evaluations.schemas.js';
import type { EvaluationsService } from './evaluations.service.js';

/** Camada HTTP apenas: lê a requisição (já validada), delega ao service e monta a resposta. */
export function createEvaluationsController(deps: { evaluationsService: EvaluationsService }) {
  const { evaluationsService } = deps;

  const create: RequestHandler<Record<string, string>, unknown, CreateEvaluationInput> = async (req, res) => {
    const evaluation = await evaluationsService.createEvaluation(viewerOf(req), req.body);
    res.status(201).json({ evaluation });
  };

  const list = async (query: ListEvaluationsQuery, req: Request, res: Response): Promise<void> => {
    const evaluations = await evaluationsService.listEvaluations(viewerOf(req), query);
    res.status(200).json({ evaluations });
  };

  const getById = async ({ id }: EvaluationIdParam, req: Request, res: Response): Promise<void> => {
    const evaluation = await evaluationsService.getEvaluation(viewerOf(req), id);
    res.status(200).json({ evaluation });
  };

  /** `req.body` já passou pelo validateBody(updateEvaluationSchema) na rota. */
  const update = async ({ id }: EvaluationIdParam, req: Request, res: Response): Promise<void> => {
    const input: UpdateEvaluationInput = req.body;
    const evaluation = await evaluationsService.updateEvaluation(viewerOf(req), id, input);
    res.status(200).json({ evaluation });
  };

  return { create, list, getById, update };
}
