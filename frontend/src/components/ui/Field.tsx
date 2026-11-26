import { useId, type ReactNode } from 'react';

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
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-zinc-900">
        {label}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && (
        <p id={hintId} className="text-xs text-zinc-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
