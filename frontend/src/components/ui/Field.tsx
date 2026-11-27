import { useId, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { useSurface } from './surface';

export interface FieldControlProps {
  id: string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
}

interface FieldProps {
  label: string;
  error?: string | undefined;
  hint?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/** Label + controle + dica + erro, ligados por `aria-describedby` (spec 05 §4.3). */
export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  const dark = useSurface() === 'dark';
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={cn('text-sm font-medium', dark ? 'text-purple-100' : 'text-zinc-800')}>
        {label}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && (
        <p id={hintId} className={cn('text-xs', dark ? 'text-purple-200' : 'text-zinc-500')}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className={cn('text-sm', dark ? 'text-red-200' : 'text-red-700')}>
          {error}
        </p>
      )}
    </div>
  );
}
