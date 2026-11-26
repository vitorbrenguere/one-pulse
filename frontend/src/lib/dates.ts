import type { GoalDTO, GoalStatus } from '../types/api';

export interface CycleOption {
  value: string;
  label: string;
  isCurrent: boolean;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const CYCLE = /^(\d{4})-S([12])$/;
const TERMINAL: readonly GoalStatus[] = ['CONCLUIDA', 'CANCELADA'];

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** `AAAA-MM-DD` → `dd/mm/aaaa`, sem passar por `Date` (spec 05 §4.5, D-09). */
export function formatDate(dateOnly: string): string {
  const match = DATE_ONLY.exec(dateOnly);
  if (!match) return dateOnly;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

/** Timestamp ISO → data no fuso local `dd/mm/aaaa` (ADR-06: conversão só na apresentação). */
export function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/** Hoje em UTC, `AAAA-MM-DD` (spec 03 §2.6). */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Atrasada: prazo antes de hoje (UTC) e meta não terminal. Comparação lexicográfica é válida em `AAAA-MM-DD`. */
export function isOverdue(goal: Pick<GoalDTO, 'targetDate' | 'status'>, today: string = todayUtc()): boolean {
  return goal.targetDate < today && !TERMINAL.includes(goal.status);
}

interface Cycle {
  year: number;
  half: 1 | 2;
}

const toValue = ({ year, half }: Cycle): string => `${year}-S${half}`;
const shift = ({ year, half }: Cycle, delta: -1 | 1): Cycle => {
  if (delta === 1) return half === 1 ? { year, half: 2 } : { year: year + 1, half: 1 };
  return half === 2 ? { year, half: 1 } : { year: year - 1, half: 2 };
};

function cycleOf(now: Date): Cycle {
  return { year: now.getUTCFullYear(), half: now.getUTCMonth() < 6 ? 1 : 2 };
}

export function currentCycle(now: Date = new Date()): string {
  return toValue(cycleOf(now));
}

/** Ciclo anterior, atual (marcado) e próximo (spec 05 Q-06). */
export function cycleOptions(now: Date = new Date()): CycleOption[] {
  const current = cycleOf(now);
  return [shift(current, -1), current, shift(current, 1)].map((cycle) => {
    const value = toValue(cycle);
    return { value, label: formatCycle(value), isCurrent: cycle === current };
  });
}

/** `2026-S2` → `2º semestre de 2026`. */
export function formatCycle(cycle: string): string {
  const match = CYCLE.exec(cycle);
  if (!match) return cycle;
  const [, year, half] = match;
  return `${half}º semestre de ${year}`;
}
