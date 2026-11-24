import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';
import { validationError } from '../errors/validation-error.js';

/**
 * Valida `req.params` ANTES do handler e entrega os params já convertidos e TIPADOS.
 *
 * Por que um wrapper, e não um middleware que sobrescreve `req.params` (como o validateBody)?
 * O Express tipa params como `Record<string, string>`. Substituí-los por `{ id: number }`
 * exigiria um cast no controller. O wrapper mantém a validação antes da lógica, com tipo
 * garantido pelo compilador e sem `as`.
 */
export function withValidatedParams<TParams>(
  schema: z.ZodType<TParams>,
  handler: (params: TParams, req: Request, res: Response) => void | Promise<void>,
): RequestHandler {
  return async (req, res) => {
    const result = schema.safeParse(req.params);
    if (!result.success) throw validationError(result.error);
    await handler(result.data, req, res);
  };
}
