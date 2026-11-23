import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError, type ValidationDetail } from '../errors/app-error.js';

function toValidationDetails(error: z.ZodError): ValidationDetail[] {
  return error.issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({ field: key, message: 'Campo não permitido.' }));
    }
    return [{ field: issue.path.map(String).join('.') || 'body', message: issue.message }];
  });
}

/**
 * Valida `req.body` com o schema e o substitui pelos dados JÁ normalizados
 * (trim, lowercase...). Assim o controller só recebe entrada válida.
 */
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos.', toValidationDetails(result.error)));
      return;
    }
    req.body = result.data;
    next();
  };
}
