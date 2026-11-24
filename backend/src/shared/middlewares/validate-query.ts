import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { validationError } from '../errors/validation-error.js';

/**
 * Valida `req.query` ANTES do handler e entrega a query já convertida e TIPADA.
 *
 * Mesmo padrão do `withValidatedParams`, por um motivo extra: no Express 5, `req.query`
 * é um getter e não pode ser reatribuído, então um middleware "substituidor" não funcionaria.
 */
export function withValidatedQuery<TQuery>(
  schema: z.ZodType<TQuery>,
  handler: (query: TQuery, req: Request, res: Response) => void | Promise<void>,
): RequestHandler {
  return async (req, res) => {
    const result = schema.safeParse(req.query);
    if (!result.success) throw validationError(result.error);
    await handler(result.data, req, res);
  };
}
