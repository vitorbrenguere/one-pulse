import type { ApiErrorDetail } from '../types/api';

export interface SplitFormErrors {
  /** Erros de campos que existem no formulário. */
  fieldErrors: Record<string, string>;
  /** Mensagens que não pertencem a um campo do formulário (ex.: `field: "body"`), para o banner. */
  formErrors: string[];
}

export function splitFormErrors(details: readonly ApiErrorDetail[], fields: readonly string[]): SplitFormErrors {
  void details;
  void fields;
  throw new Error('Not implemented: splitFormErrors');
}
