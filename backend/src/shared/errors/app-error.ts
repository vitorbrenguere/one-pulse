/** Catálogo de códigos de erro (spec 01-auth §2.5 + spec 03 §2.9). */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_JSON'
  | 'INVALID_CREDENTIALS'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'EMAIL_ALREADY_IN_USE'
  | 'INVALID_STATUS_TRANSITION'
  | 'GOAL_LOCKED'
  | 'GOAL_NOT_DELETABLE'
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

// ---- Fábricas de erros transversais (usadas por vários módulos) ----

/** 401: sessão ausente, inválida, expirada, ou usuário inexistente/inativo (spec 01). */
export const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', 'Autenticação necessária.');

/** 403: o PAPEL não permite a AÇÃO (RBAC-02, spec 02 §2.5). */
export const forbidden = () => new AppError(403, 'FORBIDDEN', 'Você não tem permissão para esta ação.');
