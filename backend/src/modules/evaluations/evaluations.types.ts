/** Tipos do domínio de avaliações de desempenho (spec 04). */

export const EVALUATION_STATUSES = ['ABERTA', 'CONCLUIDA'] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

/** Papel do viewer em relação a uma avaliação (spec 04 §2.2). */
export type EvaluationAccess = 'EVALUATEE' | 'EVALUATOR' | 'NONE';

/** As duas partes independentes de uma avaliação (spec 04 §2.1). */
export type EvaluationPart = 'SELF' | 'MANAGER';

/** Representação interna, já mapeada de snake_case pelo repository. */
export interface EvaluationRecord {
  id: number;
  userId: number;
  managerId: number;
  /** `AAAA-SN` */
  cycle: string;
  status: EvaluationStatus;
  selfScore: number | null;
  selfComments: string | null;
  selfSubmittedAt: Date | null;
  managerScore: number | null;
  managerFeedback: string | null;
  managerSubmittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Representação pública (spec 04 §4.0). Campos ocultos pela §2.5 saem como `null`. */
export interface EvaluationDTO {
  id: number;
  userId: number;
  managerId: number;
  cycle: string;
  status: EvaluationStatus;
  selfScore: number | null;
  selfComments: string | null;
  /** ISO 8601 em UTC */
  selfSubmittedAt: string | null;
  managerScore: number | null;
  managerFeedback: string | null;
  /** ISO 8601 em UTC */
  managerSubmittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Parte do registro afetada pelas regras EVR-02..06 (spec 04 §2.4). */
export type EvaluationState = Pick<
  EvaluationRecord,
  | 'status'
  | 'selfScore'
  | 'selfComments'
  | 'selfSubmittedAt'
  | 'managerScore'
  | 'managerFeedback'
  | 'managerSubmittedAt'
>;

/**
 * Mudanças pedidas num PATCH (spec 04 §3.4). Ausente = não alterar; `null` = limpar.
 * O service garante, antes das regras, que só há campos da parte do viewer (403).
 */
export interface EvaluationChanges {
  selfScore?: number | null | undefined;
  selfComments?: string | null | undefined;
  managerScore?: number | null | undefined;
  managerFeedback?: string | null | undefined;
  submit?: true | undefined;
}

export interface NewEvaluation {
  userId: number;
  managerId: number;
  cycle: string;
}

/** O que o service manda persistir num UPDATE. Ausente = não alterar. */
export interface EvaluationUpdate {
  status?: EvaluationStatus | undefined;
  selfScore?: number | null | undefined;
  selfComments?: string | null | undefined;
  selfSubmittedAt?: Date | null | undefined;
  managerScore?: number | null | undefined;
  managerFeedback?: string | null | undefined;
  managerSubmittedAt?: Date | null | undefined;
}

export interface EvaluationListFilter {
  cycle?: string | undefined;
}

/** Lançado por `create` quando o UNIQUE(user_id, cycle) é violado (spec 04 EVAL-08). */
export class DuplicateEvaluationError extends Error {
  constructor() {
    super('Já existe avaliação para este usuário neste ciclo.');
    this.name = 'DuplicateEvaluationError';
  }
}

/** Porta de persistência de avaliações (implementada em evaluations.repository.ts). */
export interface EvaluationsRepository {
  /** Lança DuplicateEvaluationError se já existir avaliação para (userId, cycle). */
  create(data: NewEvaluation): Promise<EvaluationRecord>;
  findById(id: number): Promise<EvaluationRecord | null>;
  /** Avaliações em que `userId` é o avaliado, ordenadas por cycle DESC, id ASC (spec 04 §4.2). */
  listByUserId(userId: number, filter: EvaluationListFilter): Promise<EvaluationRecord[]>;
  /**
   * Avaliações ABERTAS POR `managerId` cujo avaliado é HOJE liderado direto ATIVO dele
   * (spec 04 §4.2, D-07), ordenadas por cycle DESC, id ASC.
   */
  listByManagerId(managerId: number, filter: EvaluationListFilter): Promise<EvaluationRecord[]>;
  /** Atualiza só os campos presentes e devolve o registro relido (null se o id não existir). */
  update(id: number, changes: EvaluationUpdate): Promise<EvaluationRecord | null>;
}
