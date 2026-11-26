import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ErrorBanner, LoadingState } from '../components/ui/States';
import { readAuthRedirectState, SESSION_EXPIRED_NOTICE, type AuthRedirectState } from '../features/auth/redirect-state';
import { useSession } from '../features/auth/useAuth';
import type { UserRole } from '../types/api';

function SessionError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <main className="mx-auto max-w-md p-6">
      <ErrorBanner error={error} onRetry={onRetry} />
    </main>
  );
}

/** Rotas protegidas: aguarda `/auth/me`; deslogado → `/login`, guardando a rota de origem. */
export function RequireAuth() {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) return <LoadingState fullPage />;
  if (session.isError) return <SessionError error={session.error} onRetry={() => void session.refetch()} />;
  if (!session.data.user) {
    const state: AuthRedirectState = { from: `${location.pathname}${location.search}` };
    if (session.data.expired) state.notice = SESSION_EXPIRED_NOTICE;
    return <Navigate to="/login" replace state={state} />;
  }
  return <Outlet />;
}

/** `/login` e `/register`: logado → volta para a rota de origem (ou `/dashboard`). */
export function PublicOnly() {
  const session = useSession();
  const location = useLocation();

  if (session.isPending) return <LoadingState fullPage />;
  if (session.data?.user) {
    const { from } = readAuthRedirectState(location.state);
    return <Navigate to={from ?? '/dashboard'} replace />;
  }
  return <Outlet />;
}

/** Conveniência de UX; a proteção real é o 403/404 da API (spec 05 §5). */
export function RequireRole({ role }: { role: UserRole }) {
  const user = useSession().data?.user;
  if (user?.role !== role) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
