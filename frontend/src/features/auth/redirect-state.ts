/** Estado de navegação usado entre os guards e as páginas públicas. */
export interface AuthRedirectState {
  /** Rota protegida a retomar após o login (pathname + search). */
  from?: string;
  /** Aviso exibido no topo do login. */
  notice?: string;
}

export const SESSION_EXPIRED_NOTICE = 'Sua sessão expirou. Entre novamente.';
export const ACCOUNT_CREATED_NOTICE = 'Conta criada. Entre para continuar.';

/** `location.state` é `unknown` por natureza: valida antes de usar. */
export function readAuthRedirectState(state: unknown): AuthRedirectState {
  if (typeof state !== 'object' || state === null) return {};
  const result: AuthRedirectState = {};
  if ('from' in state && typeof state.from === 'string' && state.from.startsWith('/')) result.from = state.from;
  if ('notice' in state && typeof state.notice === 'string') result.notice = state.notice;
  return result;
}
