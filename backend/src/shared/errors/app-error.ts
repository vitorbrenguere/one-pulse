/** Catálogo de códigos de erro (spec 01-auth §2.5). */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_JSON'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'EMAIL_ALREADY_IN_USE'
  | 'INTERNAL_ERROR';

export interface ValidationDetail {
  field: string;
  message: string;
}

/**
 * Erro de domínio/HTTP esperado. O error handler global o converte no envelope padrão.
 * Qualquer erro que NÃO seja AppError vira 500 genérico.
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: ValidationDetail[],
  ) {
    super(message);
    this.name = 'AppError';
  }
}
