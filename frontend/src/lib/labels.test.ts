import { describe, expect, it } from 'vitest';
import type { EvaluationStatus, GoalCategory, GoalStatus, UserRole } from '../types/api';
import { evaluationStatusLabel, goalCategoryLabel, goalStatusLabel, roleLabel } from './labels';

describe('rótulos pt-BR (spec 05 §4.4)', () => {
  it.each<[UserRole, string]>([
    ['COLABORADOR', 'Colaborador'],
    ['GESTOR', 'Gestor'],
  ])('[UI-07] roleLabel(%s) → %s', (value, label) => {
    expect(roleLabel(value)).toBe(label);
  });

  it.each<[GoalStatus, string]>([
    ['NAO_INICIADA', 'Não iniciada'],
    ['EM_ANDAMENTO', 'Em andamento'],
    ['CONCLUIDA', 'Concluída'],
    ['CANCELADA', 'Cancelada'],
  ])('[UI-07] goalStatusLabel(%s) → %s', (value, label) => {
    expect(goalStatusLabel(value)).toBe(label);
  });

  it.each<[GoalCategory, string]>([
    ['TECNICA', 'Técnica'],
    ['COMPORTAMENTAL', 'Comportamental'],
    ['CARREIRA', 'Carreira'],
  ])('[UI-07] goalCategoryLabel(%s) → %s', (value, label) => {
    expect(goalCategoryLabel(value)).toBe(label);
  });

  it.each<[EvaluationStatus, string]>([
    ['ABERTA', 'Em andamento'],
    ['CONCLUIDA', 'Concluída'],
  ])('[UI-07] evaluationStatusLabel(%s) → %s', (value, label) => {
    expect(evaluationStatusLabel(value)).toBe(label);
  });
});
