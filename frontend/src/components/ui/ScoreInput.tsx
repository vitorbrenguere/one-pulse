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
        className="flex flex-col gap-2"
      >
        <span id={labelId} className="text-sm font-medium text-zinc-800">
          {label}
        </span>
        <div className="flex gap-2">
          {SCORES.map((score) => (
            <label
              key={score}
              className={cn(
                'flex size-11 cursor-pointer items-center justify-center rounded-full border text-sm font-semibold transition-colors',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-purple-500 has-[:focus-visible]:ring-offset-2',
                value === score
                  ? 'border-ink-800 bg-ink-800 text-white shadow-sm'
                  : 'border-purple-200 bg-white text-ink-800 hover:bg-purple-50',
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
