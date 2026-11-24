import { Router, type RequestHandler } from 'express';
import { validateBody } from '../../shared/middlewares/validate-body.js';
import { withValidatedParams } from '../../shared/middlewares/validate-params.js';
import { withValidatedQuery } from '../../shared/middlewares/validate-query.js';
import type { createPdGoalsController } from './pd-goals.controller.js';
import { createGoalSchema, goalIdParamSchema, listGoalsQuerySchema, updateGoalSchema } from './pd-goals.schemas.js';

/** Spec 03 §4. Montado em /api/v1/pd-goals. */
export function createPdGoalsRouter(deps: {
  controller: ReturnType<typeof createPdGoalsController>;
  requireAuth: RequestHandler;
}): Router {
  const { controller, requireAuth } = deps;
  const router = Router();

  // Todas as rotas exigem sessão; o 401 vem antes de qualquer validação (§2.8).
  router.use(requireAuth);

  router.post('/', validateBody(createGoalSchema), controller.create);
  router.get('/', withValidatedQuery(listGoalsQuerySchema, controller.list));
  router.get('/:id', withValidatedParams(goalIdParamSchema, controller.getById));
  router.patch('/:id', validateBody(updateGoalSchema), withValidatedParams(goalIdParamSchema, controller.update));
  router.delete('/:id', withValidatedParams(goalIdParamSchema, controller.remove));

  return router;
}
