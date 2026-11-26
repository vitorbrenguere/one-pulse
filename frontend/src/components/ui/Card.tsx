import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface SectionCardProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Região nomeada pelo título (`<section aria-labelledby>`, spec 05 §6.6). */
export function SectionCard({ title, actions, children, className }: SectionCardProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn('rounded-lg border border-zinc-200 bg-white p-5 shadow-sm', className)}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 id={headingId} className="text-lg font-semibold text-zinc-900">
          {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
