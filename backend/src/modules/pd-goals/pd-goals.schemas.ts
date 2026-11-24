import { z } from 'zod';
import { notImplemented } from '../../shared/utils/not-implemented.js';
import type { GoalCategory, GoalStatus } from './pd-goals.types.js';

/**
 * Spec 03 §3.
 *
 * ⚠️ STUB da etapa RED: os schemas lançam em qualquer parse (nem aceitam nem rejeitam),
 * para que nenhum teste de validação passe por acidente. Na etapa GREEN, os schemas reais
 * substituem os stubs e os tipos abaixo passam a ser `z.infer<typeof ...>` (CLAUDE.md §5).
 */

export interface GoalIdParam {
  id: number;
}

export interface ListGoalsQuery {
  userId?: number | undefined;
}

export interface CreateGoalInput {
  title: string;
  description?: string | null | undefined;
  category: GoalCategory;
  targetDate: string;
  userId?: number | undefined;
}

export interface UpdateGoalInput {
  title?: string | undefined;
  description?: string | null | undefined;
  category?: GoalCategory | undefined;
  targetDate?: string | undefined;
  status?: GoalStatus | undefined;
  progress?: number | undefined;
  managerFeedback?: string | null | undefined;
}

function notImplementedSchema<T>(name: string): z.ZodType<T> {
  return z.custom<T>(() => notImplemented(name));
}

export const goalIdParamSchema = notImplementedSchema<GoalIdParam>('goalIdParamSchema');
export const listGoalsQuerySchema = notImplementedSchema<ListGoalsQuery>('listGoalsQuerySchema');
export const createGoalSchema = notImplementedSchema<CreateGoalInput>('createGoalSchema');
export const updateGoalSchema = notImplementedSchema<UpdateGoalInput>('updateGoalSchema');
