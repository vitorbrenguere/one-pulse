import { Router, type RequestHandler } from 'express';
import { validateBody } from '../../shared/middlewares/validate-body.js';
import type { createAuthController } from './auth.controller.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

export function createAuthRouter(deps: {
  controller: ReturnType<typeof createAuthController>;
  requireAuth: RequestHandler;
}): Router {
  const { controller, requireAuth } = deps;
  const router = Router();

  router.post('/register', validateBody(registerSchema), controller.register);
  router.post('/login', validateBody(loginSchema), controller.login);
  router.post('/logout', controller.logout);
  router.get('/me', requireAuth, controller.me);

  return router;
}
