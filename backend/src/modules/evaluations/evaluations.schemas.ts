import { z } from 'zod';
import { notImplemented } from '../../shared/utils/not-implemented.js';

/**
 * Spec 04 §3.
 *
 * ⚠️ STUB da etapa RED: os schemas lançam em qualquer parse (nem aceitam nem rejeitam),
 * para que nenhum teste de validação passe por acidente. Na etapa GREEN, os schemas reais
 * substituem os stubs e os tipos abaixo passam a ser `z.infer<typeof ...>` (CLAUDE.md §5).
 */

export interface EvaluationIdParam {
  id: number;
}

export interface ListEvaluationsQuery {
  userId?: number | undefined;
  cycle?: string | undefined;
}

export interface CreateEvaluationInput {
  userId: number;
  cycle: string;
}

export interface UpdateEvaluationInput {
  selfScore?: number | null | undefined;
  selfComments?: string | null | undefined;
  managerScore?: number | null | undefined;
  managerFeedback?: string | null | undefined;
  submit?: true | undefined;
}

function notImplementedSchema<T>(name: string): z.ZodType<T> {
  return z.custom<T>(() => notImplemented(name));
}

export const evaluationIdParamSchema = notImplementedSchema<EvaluationIdParam>('evaluationIdParamSchema');
export const listEvaluationsQuerySchema = notImplementedSchema<ListEvaluationsQuery>('listEvaluationsQuerySchema');
export const createEvaluationSchema = notImplementedSchema<CreateEvaluationInput>('createEvaluationSchema');
export const updateEvaluationSchema = notImplementedSchema<UpdateEvaluationInput>('updateEvaluationSchema');
