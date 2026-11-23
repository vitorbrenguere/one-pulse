import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../errors/app-error.js';

/** O body-parser (express.json) marca erros de sintaxe com este `type`. */
function isJsonSyntaxError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    (error as SyntaxError & { type?: string }).type === 'entity.parse.failed'
  );
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, 'NOT_FOUND', 'Recurso não encontrado.'));
};

/**
 * Error handler global: converte qualquer erro no envelope padrão
 * `{ error: { code, message, details? } }`. Erros inesperados viram um 500 genérico:
 * mensagem, stack e detalhes internos NUNCA vão para o cliente (AUTH-27).
 */
export function createErrorHandler(options: { logUnexpected: boolean }): ErrorRequestHandler {
  return (error: unknown, _req, res, _next) => {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      });
      return;
    }

    if (isJsonSyntaxError(error)) {
      res.status(400).json({ error: { code: 'INVALID_JSON', message: 'O corpo da requisição não é um JSON válido.' } });
      return;
    }

    if (options.logUnexpected) {
      // O log fica só no servidor; o corpo da requisição não é logado (pode conter senha).
      console.error('[error-handler] Erro inesperado:', error);
    }
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } });
  };
}
