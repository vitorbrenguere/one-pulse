import { Router, type RequestHandler } from 'express';
import { requireRole } from '../../shared/middlewares/require-role.js';
import { validateBody } from '../../shared/middlewares/validate-body.js';
import { withValidatedParams } from '../../shared/middlewares/validate-params.js';
import type { createUsersController } from './users.controller.js';
import { updateProfileSchema, userIdParamSchema } from './users.schemas.js';

export function createUsersRouter(deps: {
  controller: ReturnType<typeof createUsersController>;
  requireAuth: RequestHandler;
}): Router {
  const { controller, requireAuth } = deps;
  const router = Router();

  // Todas as rotas de /users exigem sessão. O 401 vem antes de qualquer validação (USER-16).
  router.use(requireAuth);

  // ⚠️ Ordem importa: rotas literais (/team, /me) ANTES da rota com parâmetro (/:id).
  router.get('/team', requireRole('GESTOR'), controller.team);
  router.patch('/me', validateBody(updateProfileSchema), controller.updateMe);
  router.get('/:id', withValidatedParams(userIdParamSchema, controller.getById));

  return router;
}
