import { AlertCircle, Inbox, LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { errorMessage } from '../../services/http';
import { Button } from './Button';

export function LoadingState({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div
      role="status"
      className={cn('flex items-center justify-center gap-2 text-zinc-600', fullPage ? 'min-h-screen' : 'py-8')}
    >
      <LoaderCircle aria-hidden="true" className="size-5 animate-spin" />
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
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-zinc-300 px-4 py-8 text-center">
      <Inbox aria-hidden="true" className="size-6 text-zinc-500" />
      <p className="font-medium text-zinc-900">{title}</p>
      {description && <p className="text-sm text-zinc-600">{description}</p>}
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
    <div role="alert" className="flex flex-wrap items-start gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1">{message}</p>
      {onRetry && (
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}

/** Aviso informativo (não é erro): ex. "Sua sessão expirou". */
export function Notice({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{children}</p>;
}
