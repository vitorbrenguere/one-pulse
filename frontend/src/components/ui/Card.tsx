import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { SurfaceContext, type Surface } from './surface';

interface SectionCardProps {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** `dark`: card de destaque do bento grid (alto contraste). */
  tone?: Surface;
}

const TONES: Record<Surface, { card: string; heading: string; divider: string }> = {
  light: {
    card: 'border border-purple-100/80 bg-white p-6 shadow-xs',
    heading: 'text-zinc-900',
    divider: 'border-purple-100/70',
  },
  dark: {
    card: 'bg-ink-950 p-6 text-white shadow-lg shadow-purple-950/20 sm:p-8',
    heading: 'text-white',
    divider: 'border-white/10',
  },
};

/** Região nomeada pelo título (`<section aria-labelledby>`, spec 05 §6.6). */
export function SectionCard({ title, actions, children, className, tone = 'light' }: SectionCardProps) {
  const headingId = useId();
  const styles = TONES[tone];
  return (
    <SurfaceContext value={tone}>
      <section aria-labelledby={headingId} className={cn('rounded-3xl', styles.card, className)}>
        <div className={cn('mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4', styles.divider)}>
          <h2 id={headingId} className={cn('text-lg font-semibold tracking-tight', styles.heading)}>
            {title}
          </h2>
          {actions}
        </div>
        {children}
      </section>
    </SurfaceContext>
  );
}
