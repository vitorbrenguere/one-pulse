import type { EvaluationAccess, EvaluationDTO, EvaluationRecord } from './evaluations.types.js';

/**
 * Único caminho de uma avaliação para fora da API, já com a regra anti-viés (spec 04 §2.5).
 * Função PURA. Campos ocultos saem como `null`, sem mudar o formato do DTO.
 *
 * - O AVALIADO só vê a nota e o feedback do gestor quando a avaliação está CONCLUIDA:
 *   a autoavaliação não pode ser influenciada pela opinião do gestor.
 * - O GESTOR nunca vê o rascunho da autoavaliação; vê a partir do envio (Q-03).
 * - `status` e `*SubmittedAt` nunca são ocultados: dizem SE a outra parte enviou, não O QUÊ.
 *
 * A lista de campos é explícita (como em toUserDTO): um campo novo nunca vaza por acidente.
 */
export function toEvaluationDTO(evaluation: EvaluationRecord, access: Exclude<EvaluationAccess, 'NONE'>): EvaluationDTO {
  const hideSelf = access === 'EVALUATOR' && evaluation.selfSubmittedAt === null;
  const hideManager = access === 'EVALUATEE' && evaluation.status !== 'CONCLUIDA';

  return {
    id: evaluation.id,
    userId: evaluation.userId,
    managerId: evaluation.managerId,
    cycle: evaluation.cycle,
    status: evaluation.status,
    selfScore: hideSelf ? null : evaluation.selfScore,
    selfComments: hideSelf ? null : evaluation.selfComments,
    selfSubmittedAt: evaluation.selfSubmittedAt?.toISOString() ?? null,
    managerScore: hideManager ? null : evaluation.managerScore,
    managerFeedback: hideManager ? null : evaluation.managerFeedback,
    managerSubmittedAt: evaluation.managerSubmittedAt?.toISOString() ?? null,
    createdAt: evaluation.createdAt.toISOString(),
    updatedAt: evaluation.updatedAt.toISOString(),
  };
}
