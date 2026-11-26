import type { ReactNode } from 'react';
import { AuthContext, useSessionQuery } from './useAuth';

interface AuthProviderProps {
  children: ReactNode;
}

/** Sessão baseada na query `['auth','me']` (spec 05 §3.3): o contexto só repassa o resultado da query. */
export function AuthProvider({ children }: AuthProviderProps) {
  const session = useSessionQuery();
  return <AuthContext.Provider value={session}>{children}</AuthContext.Provider>;
}
