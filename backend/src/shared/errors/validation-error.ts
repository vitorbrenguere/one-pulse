import type { z } from 'zod';
import { AppError, type ValidationDetail } from './app-error.js';

function toValidationDetails(error: z.ZodError): ValidationDetail[] {
  return error.issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({ field: key, message: 'Campo não permitido.' }));
    }
    return [{ field: issue.path.map(String).join('.') || 'body', message: issue.message }];
  });
}

/** ZodError → 400 VALIDATION_ERROR com `details[]` no formato da spec 01 §2.4. */
export function validationError(error: z.ZodError): AppError {
  return new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos.', toValidationDetails(error));
}
