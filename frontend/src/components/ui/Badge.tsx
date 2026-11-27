import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import type { GoalStatus } from '../../types/api';

export type Tone = 'neutral' | 'violet' | 'emerald' | 'amber' | 'red';

const TONES: Record<Tone, string> = {
  neutral: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  violet: 'bg-violet-50 text-violet-800 ring-violet-200',
  emerald: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-900 ring-amber-200',
  red: 'bg-red-50 text-red-800 ring-red-200',
};

export const GOAL_STATUS_TONE: Record<GoalStatus, Tone> = {
  NAO_INICIADA: 'neutral',
  EM_ANDAMENTO: 'violet',
  CONCLUIDA: 'emerald',
  CANCELADA: 'neutral',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}
