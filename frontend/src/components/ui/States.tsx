import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../services/http';
import { Button } from './Button';
import { SurfaceContext, useSurface } from './surface';

export function LoadingState({ fullPage = false }: { fullPage?: boolean }) {
  const dark = useSurface() === 'dark';
  return (
    <div
      role="status"
      className={cn(
        'flex items-center justify-center gap-2',
        dark ? 'text-purple-200' : 'text-purple-600',
        fullPage ? 'min-h-screen' : 'py-8',
      )}
    >
      <LoaderCircle aria-hidden="true" className="size-6 animate-spin" />
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  const dark = useSurface() === 'dark';
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-2xl border border-dashed px-4 py-10 text-center',
        dark ? 'border-white/15 bg-white/5' : 'border-purple-200 bg-white',
      )}
    >
      <span
        className={cn(
          'mb-1 flex size-11 items-center justify-center rounded-full',
          dark ? 'bg-white/10 text-purple-200' : 'bg-purple-50 text-purple-600',
        )}
      >
        <Inbox aria-hidden="true" className="size-5" />
      </span>
      <p className={cn('font-medium', dark ? 'text-white' : 'text-zinc-900')}>{title}</p>
      {description && <p className={cn('text-sm', dark ? 'text-purple-200' : 'text-zinc-600')}>{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

interface ErrorBannerProps {
  /** Mensagem pronta ou o erro (usa a `message` do ApiError). */
  error: unknown;
  onRetry?: () => void;
}

export function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  const message = typeof error === 'string' ? error : errorMessage(error);
  return (
    // A caixa é sempre clara: o botão interno usa a variante de superfície clara mesmo dentro do card escuro.
    <SurfaceContext value="light">
      <div
        role="alert"
        className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
      >
        <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
        <p className="flex-1">{message}</p>
        {onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
      </div>
    </SurfaceContext>
  );
}

/** Aviso informativo (não é erro): ex. "Sua sessão expirou". */
export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{children}</p>;
}
