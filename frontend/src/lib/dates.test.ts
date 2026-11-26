import { describe, expect, it } from 'vitest';
import type { GoalStatus } from '../types/api';
import { currentCycle, cycleOptions, formatCycle, formatDate, formatDateTime, isOverdue, todayUtc } from './dates';

describe('datas (spec 05 §4.5)', () => {
  it.each([
    ['2027-03-31', '31/03/2027'],
    ['2026-01-01', '01/01/2026'],
    ['2099-12-31', '31/12/2099'],
  ])('[UI-05] formatDate(%s) → %s, sem deslocamento de fuso', (input, expected) => {
    // Pré-condição contra falso verde: em UTC, `new Date(input)` não deslocaria o dia e o bug passaria.
    expect(new Date(input).getDate()).not.toBe(Number(input.slice(8, 10)));
    expect(formatDate(input)).toBe(expected);
  });

  it('[UI-05] formatDateTime converte o timestamp UTC para a data local', () => {
    // 01:00 UTC do dia 25 = 22:00 do dia 24 em Brasília.
    expect(formatDateTime('2026-11-25T01:00:00.000Z')).toBe('24/11/2026');
  });

  it.each([
    ['23h30 em Brasília (02h30 UTC do dia seguinte)', '2026-11-24T23:30:00-03:00', '2026-11-25'],
    ['meio-dia UTC', '2026-11-24T12:00:00.000Z', '2026-11-24'],
  ])('[UI-05] todayUtc às %s → %s', (_case, now, expected) => {
    expect(todayUtc(new Date(now))).toBe(expected);
  });

  it.each<[string, GoalStatus, boolean]>([
    ['2026-11-23', 'NAO_INICIADA', true],
    ['2026-11-23', 'EM_ANDAMENTO', true],
    ['2026-11-23', 'CONCLUIDA', false],
    ['2026-11-23', 'CANCELADA', false],
    ['2026-11-24', 'EM_ANDAMENTO', false],
    ['2026-11-25', 'NAO_INICIADA', false],
  ])('[UI-05] isOverdue(prazo %s, %s) com hoje = 2026-11-24 → %s', (targetDate, status, expected) => {
    expect(isOverdue({ targetDate, status }, '2026-11-24')).toBe(expected);
  });
});

describe('ciclos (spec 05 §4.5, Q-06)', () => {
  it.each([
    ['2026-01-01T00:00:00.000Z', '2026-S1'],
    ['2026-06-30T23:59:59.000Z', '2026-S1'],
    ['2026-07-01T00:00:00.000Z', '2026-S2'],
    ['2026-12-31T23:59:59.000Z', '2026-S2'],
  ])('[UI-06] currentCycle(%s) → %s', (now, expected) => {
    expect(currentCycle(new Date(now))).toBe(expected);
  });

  it('[UI-06] cycleOptions em 2026-S1: anterior, atual (marcado) e próximo', () => {
    expect(cycleOptions(new Date('2026-03-10T12:00:00.000Z'))).toEqual([
      { value: '2025-S2', label: '2º semestre de 2025', isCurrent: false },
      { value: '2026-S1', label: '1º semestre de 2026', isCurrent: true },
      { value: '2026-S2', label: '2º semestre de 2026', isCurrent: false },
    ]);
  });

  it('[UI-06] cycleOptions em 2026-S2 vira o ano no próximo ciclo', () => {
    expect(cycleOptions(new Date('2026-11-24T12:00:00.000Z')).map((o) => o.value)).toEqual([
      '2026-S1',
      '2026-S2',
      '2027-S1',
    ]);
  });

  it.each([
    ['2026-S1', '1º semestre de 2026'],
    ['2026-S2', '2º semestre de 2026'],
  ])('[UI-06] formatCycle(%s) → %s', (cycle, expected) => {
    expect(formatCycle(cycle)).toBe(expected);
  });
});
