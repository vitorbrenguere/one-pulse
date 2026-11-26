import { cn } from '../../lib/cn';

export function ProgressBar({ value, label = 'Progresso' }: { value: number; label?: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className="h-2 w-full overflow-hidden rounded-full bg-zinc-200"
    >
      <div
        className={cn('h-full rounded-full', clamped === 100 ? 'bg-emerald-600' : 'bg-zinc-900')}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
