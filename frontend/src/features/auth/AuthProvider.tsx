import type { ReactNode } from 'react';

interface AuthProviderProps {
  children: ReactNode;
}

/** Sessão baseada na query `['auth','me']` (spec 05 §3.3). */
export function AuthProvider({ children }: AuthProviderProps) {
  return <>{children}</>;
}
