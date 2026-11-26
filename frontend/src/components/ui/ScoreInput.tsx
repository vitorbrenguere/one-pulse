import { useId } from 'react';
import { cn } from '../../lib/cn';

interface ScoreInputProps {
  value: number | null;
  onChange: (score: number) => void;
  error?: string | undefined;
  label?: string;
}

const SCORES = [1, 2, 3, 4, 5] as const;

/** Nota de 1 a 5 como `radiogroup` nomeado pela legenda (spec 05 §6.5.4). */
export function ScoreInput({ value, onChange, error, label = 'Nota' }: ScoreInputProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? true : undefined}
        className="flex flex-col gap-1.5"
      >
        <span id={labelId} className="text-sm font-medium text-zinc-900">
          {label}
        </span>
        <div className="flex gap-2">
          {SCORES.map((score) => (
            <label
              key={score}
              className={cn(
                'flex size-10 cursor-pointer items-center justify-center rounded-md border text-sm font-medium',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-zinc-900 has-[:focus-visible]:ring-offset-2',
                value === score ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 bg-white text-zinc-900',
              )}
            >
              <input
                type="radio"
                name={id}
                value={score}
                checked={value === score}
                onChange={() => onChange(score)}
                className="sr-only"
              />
              {score}
            </label>
          ))}
        </div>
      </div>
      {error && (
        <p id={errorId} className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
