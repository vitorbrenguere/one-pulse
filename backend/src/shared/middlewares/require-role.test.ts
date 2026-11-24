import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { describe, expect, it } from 'vitest';
import type { UserDTO, UserRole } from '../../modules/users/user.types.js';
import { requireRole } from './require-role.js';

const userWithRole = (role: UserRole): UserDTO => ({
  id: 1,
  name: 'Ana Souza',
  email: 'ana@onepulse.dev',
  role,
  managerId: null,
  jobTitle: null,
  createdAt: '2026-11-24T12:00:00.000Z',
});

type Outcome = { passed: true } | { passed: false; error: unknown };

/**
 * Executa o middleware e normaliza o resultado. Aceita as duas formas idiomáticas de
 * falhar no Express 5 (lançar ou chamar next(err)), para o teste não depender desse detalhe.
 */
function run(middleware: RequestHandler, user: UserDTO | undefined): Outcome {
  let outcome: Outcome | undefined;
  const next: NextFunction = (error?: unknown) => {
    outcome = error === undefined ? { passed: true } : { passed: false, error };
  };
  try {
    void middleware({ user } as Request, {} as Response, next);
  } catch (error) {
    outcome = { passed: false, error };
  }
  if (!outcome) throw new Error('O middleware não chamou next() nem lançou erro.');
  return outcome;
}

describe('requireRole', () => {
  it('[USER-24] papel permitido → chama next() sem erro', () => {
    expect(run(requireRole('GESTOR'), userWithRole('GESTOR'))).toEqual({ passed: true });
  });

  it('[USER-24] aceita qualquer um dos papéis listados', () => {
    const middleware = requireRole('GESTOR', 'COLABORADOR');

    expect(run(middleware, userWithRole('COLABORADOR'))).toEqual({ passed: true });
    expect(run(middleware, userWithRole('GESTOR'))).toEqual({ passed: true });
  });

  it('[USER-24] papel não permitido → 403 FORBIDDEN', () => {
    expect(run(requireRole('GESTOR'), userWithRole('COLABORADOR'))).toMatchObject({
      passed: false,
      error: { statusCode: 403, code: 'FORBIDDEN', message: 'Você não tem permissão para esta ação.' },
    });
  });

  it('[USER-24] sem req.user (requireAuth esquecido) → 401 UNAUTHENTICATED', () => {
    expect(run(requireRole('GESTOR'), undefined)).toMatchObject({
      passed: false,
      error: { statusCode: 401, code: 'UNAUTHENTICATED' },
    });
  });
});
