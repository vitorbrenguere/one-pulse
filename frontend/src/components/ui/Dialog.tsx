import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

const FOCUSABLE_PARTS = ['input', 'select', 'textarea', 'button', '[href]', '[tabindex]:not([tabindex="-1"])'];
const FOCUSABLE = FOCUSABLE_PARTS.join(', ');
/** Prefere o primeiro campo do formulário ao botão "Fechar" do cabeçalho. */
const FORM_FOCUSABLE = FOCUSABLE_PARTS.map((part) => `form ${part}`).join(', ');

interface DialogProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Diálogo modal acessível (spec 05 UI-63): nome pelo título, foco no primeiro campo ao abrir,
 * `Esc` fecha e o foco volta para o elemento que o abriu.
 */
export function Dialog({ title, onClose, children }: DialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FORM_FOCUSABLE) ?? panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-900/40 sm:items-center sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-full w-full flex-col overflow-y-auto bg-white p-6 shadow-xl sm:max-w-lg sm:rounded-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-lg font-semibold text-zinc-900">
            {title}
          </h2>
          <Button variant="ghost" size="sm" aria-label="Fechar" onClick={onClose}>
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
  danger?: boolean;
}

export function ConfirmDialog({ title, message, onConfirm, onCancel, pending = false, danger = false }: ConfirmDialogProps) {
  return (
    <Dialog title={title} onClose={onCancel}>
      <p className="text-sm text-zinc-700">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={pending}>
          Confirmar
        </Button>
      </div>
    </Dialog>
  );
}
