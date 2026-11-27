import { cn } from '../../lib/cn';
import { useSurface } from './surface';

export function ProgressBar({ value, label = 'Progresso' }: { value: number; label?: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  const dark = useSurface() === 'dark';
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn('h-2.5 w-full overflow-hidden rounded-full', dark ? 'bg-white/10' : 'bg-purple-100/70')}
    >
      <div
        className={cn(
          'h-full rounded-full bg-linear-to-r transition-[width] duration-500',
          clamped === 100 ? 'from-emerald-500 to-emerald-400' : 'from-purple-600 to-violet-500',
        )}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
