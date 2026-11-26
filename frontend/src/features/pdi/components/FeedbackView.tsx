import { MessageSquareQuote } from 'lucide-react';
import { formatDateTime } from '../../../lib/dates';

/** Parecer do gestor somente leitura, com a data do registro. */
export function FeedbackView({ feedback, at }: { feedback: string; at: string | null }) {
  return (
    <div className="flex gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <MessageSquareQuote aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-zinc-500" />
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-zinc-600">
          {at ? `Parecer do gestor · ${formatDateTime(at)}` : 'Parecer do gestor'}
        </p>
        <p className="whitespace-pre-line text-sm text-zinc-900">{feedback}</p>
      </div>
    </div>
  );
}
