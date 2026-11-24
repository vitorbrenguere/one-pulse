import { Router, type RequestHandler } from 'express';
import { requireRole } from '../../shared/middlewares/require-role.js';
import { validateBody } from '../../shared/middlewares/validate-body.js';
import { withValidatedParams } from '../../shared/middlewares/validate-params.js';
import { withValidatedQuery } from '../../shared/middlewares/validate-query.js';
import type { createEvaluationsController } from './evaluations.controller.js';
import {
  createEvaluationSchema,
  evaluationIdParamSchema,
  listEvaluationsQuerySchema,
  updateEvaluationSchema,
} from './evaluations.schemas.js';

/** Spec 04 §4. Montado em /api/v1/evaluations. */
export function createEvaluationsRouter(deps: {
  controller: ReturnType<typeof createEvaluationsController>;
  requireAuth: RequestHandler;
}): Router {
  const { controller, requireAuth } = deps;
  const router = Router();

  // Todas as rotas exigem sessão; o 401 vem antes de qualquer validação (§2.7).
  router.use(requireAuth);

  // Abrir avaliação é ação DE PAPEL (RBAC-02): o 403 do COLABORADOR vem antes do 400 do corpo.
  router.post('/', requireRole('GESTOR'), validateBody(createEvaluationSchema), controller.create);
  router.get('/', withValidatedQuery(listEvaluationsQuerySchema, controller.list));
  router.get('/:id', withValidatedParams(evaluationIdParamSchema, controller.getById));
  router.patch(
    '/:id',
    validateBody(updateEvaluationSchema),
    withValidatedParams(evaluationIdParamSchema, controller.update),
  );

  return router;
}
