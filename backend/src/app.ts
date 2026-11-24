import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import type { Pool } from 'mysql2/promise';
import type { Env } from './config/env.js';
import { createAuthController } from './modules/auth/auth.controller.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createBcryptPasswordHasher } from './modules/auth/password-hasher.js';
import { createRequireAuth } from './modules/auth/require-auth.middleware.js';
import { createJwtTokenService } from './modules/auth/token-service.js';
import { createEvaluationsController } from './modules/evaluations/evaluations.controller.js';
import { createEvaluationsRepository } from './modules/evaluations/evaluations.repository.js';
import { createEvaluationsRouter } from './modules/evaluations/evaluations.routes.js';
import { createEvaluationsService } from './modules/evaluations/evaluations.service.js';
import { createPdGoalsController } from './modules/pd-goals/pd-goals.controller.js';
import { createPdGoalsRepository } from './modules/pd-goals/pd-goals.repository.js';
import { createPdGoalsRouter } from './modules/pd-goals/pd-goals.routes.js';
import { createPdGoalsService } from './modules/pd-goals/pd-goals.service.js';
import { createUsersController } from './modules/users/users.controller.js';
import { createUsersRepository } from './modules/users/users.repository.js';
import { createUsersRouter } from './modules/users/users.routes.js';
import { createUsersService } from './modules/users/users.service.js';
import { createErrorHandler, notFoundHandler } from './shared/middlewares/error-handler.js';

export interface AppDependencies {
  env: Env;
  pool: Pool;
}

/**
 * Composition root: monta as dependências e o app Express SEM chamar `listen`,
 * para que os testes usem o Supertest e injetem dependências (ex.: um pool quebrado no AUTH-27).
 */
export function createApp({ env, pool }: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');

  // ---- Middlewares globais ----
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  // strict: false aceita qualquer JSON válido (ex.: "texto"); o Zod decide se o formato serve.
  app.use(express.json({ strict: false, limit: '100kb' }));
  app.use(cookieParser());

  // ---- Dependências ----
  const usersRepository = createUsersRepository(pool);
  const passwordHasher = createBcryptPasswordHasher(env.BCRYPT_ROUNDS);
  const tokenService = createJwtTokenService({ secret: env.JWT_SECRET, expiresInSeconds: env.JWT_EXPIRES_IN_SECONDS });
  const authService = createAuthService({
    usersRepository,
    passwordHasher,
    tokenService,
    // Mesmo custo do hash real, para o timing attack do AUTH-15 não ter diferença a explorar.
    dummyPasswordHash: bcrypt.hashSync(randomBytes(32).toString('hex'), env.BCRYPT_ROUNDS),
  });

  const usersService = createUsersService({ usersRepository });
  const pdGoalsService = createPdGoalsService({
    goalsRepository: createPdGoalsRepository(pool),
    usersRepository,
    now: () => new Date(),
  });
  const evaluationsService = createEvaluationsService({
    evaluationsRepository: createEvaluationsRepository(pool),
    usersRepository,
    now: () => new Date(),
  });
  const requireAuth = createRequireAuth({ authService, tokenService });

  // ---- Rotas ----
  app.use('/api/v1/auth', createAuthRouter({ controller: createAuthController({ authService, env }), requireAuth }));
  app.use('/api/v1/users', createUsersRouter({ controller: createUsersController({ usersService }), requireAuth }));
  app.use(
    '/api/v1/pd-goals',
    createPdGoalsRouter({ controller: createPdGoalsController({ pdGoalsService }), requireAuth }),
  );
  app.use(
    '/api/v1/evaluations',
    createEvaluationsRouter({ controller: createEvaluationsController({ evaluationsService }), requireAuth }),
  );

  // ---- Fallbacks ----
  app.use(notFoundHandler);
  app.use(createErrorHandler({ logUnexpected: env.NODE_ENV !== 'test' }));

  return app;
}
