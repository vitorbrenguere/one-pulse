import type { GoalDTO } from '../types/api';

export interface CycleOption {
  value: string;
  label: string;
  isCurrent: boolean;
}

/** `AAAA-MM-DD` → `dd/mm/aaaa`, sem passar por `Date` (spec 05 §4.5, D-09). */
export function formatDate(dateOnly: string): string {
  void dateOnly;
  throw new Error('Not implemented: formatDate');
}

/** Timestamp ISO → data local `dd/mm/aaaa` (ADR-06). */
export function formatDateTime(iso: string): string {
  void iso;
  throw new Error('Not implemented: formatDateTime');
}

/** Hoje em UTC, `AAAA-MM-DD` (spec 03 §2.6). */
export function todayUtc(now: Date = new Date()): string {
  void now;
  throw new Error('Not implemented: todayUtc');
}

export function isOverdue(goal: Pick<GoalDTO, 'targetDate' | 'status'>, today: string = todayUtc()): boolean {
  void goal;
  void today;
  throw new Error('Not implemented: isOverdue');
}

export function currentCycle(now: Date = new Date()): string {
  void now;
  throw new Error('Not implemented: currentCycle');
}

export function cycleOptions(now: Date = new Date()): CycleOption[] {
  void now;
  throw new Error('Not implemented: cycleOptions');
}

/** `2026-S2` → `2º semestre de 2026`. */
export function formatCycle(cycle: string): string {
  void cycle;
  throw new Error('Not implemented: formatCycle');
}
