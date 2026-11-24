import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { validationError } from '../errors/validation-error.js';

/**
 * Valida `req.body` com o schema e o substitui pelos dados JÁ normalizados
 * (trim, lowercase...). Assim o controller só recebe entrada válida.
 */
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(validationError(result.error));
      return;
    }
    req.body = result.data;
    next();
  };
}
