import { MessageSquareQuote } from 'lucide-react';
import { formatDateTime } from '../../../lib/dates';

/** Parecer do gestor somente leitura, com a data do registro. */
export function FeedbackView({ feedback, at }: { feedback: string; at: string | null }) {
  return (
    <div className="relative flex gap-4 overflow-hidden rounded-2xl bg-linear-to-br from-purple-50 to-violet-50 p-5 ring-1 ring-purple-100">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-linear-to-b from-purple-600 to-violet-500" />
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-800 text-white shadow-sm"
      >
        <MessageSquareQuote className="size-5" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-semibold tracking-wide text-purple-700">
          {at ? `Parecer do gestor · ${formatDateTime(at)}` : 'Parecer do gestor'}
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-line text-zinc-800">{feedback}</p>
      </div>
    </div>
  );
}
