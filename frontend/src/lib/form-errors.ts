import { ApiError } from '../services/http';
import type { ApiErrorDetail } from '../types/api';

export interface SplitFormErrors {
  /** Erros de campos que existem no formulário. */
  fieldErrors: Record<string, string>;
  /** Mensagens que não pertencem a um campo do formulário (ex.: `field: "body"`), para o banner. */
  formErrors: string[];
}

export function splitFormErrors(details: readonly ApiErrorDetail[], fields: readonly string[]): SplitFormErrors {
  const fieldErrors: Record<string, string> = {};
  const formErrors: string[] = [];
  for (const { field, message } of details) {
    if (!fields.includes(field)) formErrors.push(message);
    else if (!(field in fieldErrors)) fieldErrors[field] = message;
  }
  return { fieldErrors, formErrors };
}

export interface FormErrorState {
  fieldErrors: Record<string, string>;
  /** Mensagem para o banner do formulário, ou `null`. */
  banner: string | null;
}

/**
 * Converte o erro de uma mutation no estado de erro de um formulário (spec 05 §4.3):
 * `VALIDATION_ERROR` → campos + banner com o que sobrar; qualquer outro erro → banner.
 */
export function toFormErrors(error: unknown, fields: readonly string[]): FormErrorState {
  if (error instanceof ApiError && error.code === 'VALIDATION_ERROR' && error.details.length > 0) {
    const { fieldErrors, formErrors } = splitFormErrors(error.details, fields);
    return { fieldErrors, banner: formErrors.length > 0 ? formErrors.join(' ') : null };
  }
  return { fieldErrors: {}, banner: error instanceof ApiError ? error.message : 'Erro inesperado. Tente novamente.' };
}
