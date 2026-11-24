import { AppError, forbidden } from '../../shared/errors/app-error.js';
import type { UsersRepository } from '../users/user.types.js';
import type { PolicyViewer } from '../users/users.policy.js';
import { getEvaluationAccess } from './evaluations.policy.js';
import { applyEvaluationChanges } from './evaluations.rules.js';
import type { CreateEvaluationInput, ListEvaluationsQuery, UpdateEvaluationInput } from './evaluations.schemas.js';
import {
  DuplicateEvaluationError,
  type EvaluationAccess,
  type EvaluationDTO,
  type EvaluationPart,
  type EvaluationRecord,
  type EvaluationsRepository,
  type EvaluationState,
  type EvaluationUpdate,
} from './evaluations.types.js';
import { toEvaluationDTO } from './evaluations.visibility.js';

export interface EvaluationsService {
  /** POST /evaluations (spec 04 §4.1). O papel GESTOR é exigido na rota (requireRole). */
  createEvaluation(viewer: PolicyViewer, input: CreateEvaluationInput): Promise<EvaluationDTO>;
  /** GET /evaluations (spec 04 §4.2). */
  listEvaluations(viewer: PolicyViewer, query: ListEvaluationsQuery): Promise<EvaluationDTO[]>;
  /** GET /evaluations/:id (spec 04 §4.3). */
  getEvaluation(viewer: PolicyViewer, evaluationId: number): Promise<EvaluationDTO>;
  /** PATCH /evaluations/:id (spec 04 §4.4). */
  updateEvaluation(viewer: PolicyViewer, evaluationId: number, input: UpdateEvaluationInput): Promise<EvaluationDTO>;
}

export interface EvaluationsServiceDeps {
  evaluationsRepository: EvaluationsRepository;
  usersRepository: Pick<UsersRepository, 'findById'>;
  /** Relógio injetado: os testes unitários fixam a data dos envios. */
  now: () => Date;
}

// ---- Erros (spec 04 §2.6 / §2.8): corpos ÚNICOS para "não existe" e "não é seu" (RBAC-03) ----
const evaluationNotFound = () => new AppError(404, 'NOT_FOUND', 'Avaliação não encontrada.');
const userNotFound = () => new AppError(404, 'NOT_FOUND', 'Usuário não encontrado.');
const alreadyExists = () =>
  new AppError(409, 'EVALUATION_ALREADY_EXISTS', 'Já existe uma avaliação deste colaborador para o ciclo informado.');

/** Campos de cada parte (§3.4): o papel na avaliação decide qual parte o viewer pode tocar. */
const PART_FIELDS = {
  SELF: ['selfScore', 'selfComments'],
  MANAGER: ['managerScore', 'managerFeedback'],
} as const satisfies Record<EvaluationPart, ReadonlyArray<keyof UpdateEvaluationInput>>;

const STATE_FIELDS = [
  'status',
  'selfScore',
  'selfComments',
  'selfSubmittedAt',
  'managerScore',
  'managerFeedback',
  'managerSubmittedAt',
] as const satisfies ReadonlyArray<keyof EvaluationState>;

/**
 * Só o que de fato mudou vai para o UPDATE. As regras são puras e copiam o estado, então
 * um campo intocado é o MESMO valor (inclusive a mesma instância de Date) e `!==` basta.
 */
function diff(current: EvaluationState, next: EvaluationState): EvaluationUpdate {
  const changes: EvaluationUpdate = {};
  for (const field of STATE_FIELDS) {
    if (next[field] !== current[field]) Object.assign(changes, { [field]: next[field] });
  }
  return changes;
}

type VisibleAccess = Exclude<EvaluationAccess, 'NONE'>;

export function createEvaluationsService(deps: EvaluationsServiceDeps): EvaluationsService {
  const { evaluationsRepository, usersRepository, now } = deps;

  /** Avaliação + papel do viewer nela. O avaliado é relido A CADA requisição (hierarquia atual). */
  async function loadVisible(
    viewer: PolicyViewer,
    evaluationId: number,
  ): Promise<{ evaluation: EvaluationRecord; access: VisibleAccess }> {
    const evaluation = await evaluationsRepository.findById(evaluationId);
    if (!evaluation) throw evaluationNotFound();
    const evaluatee = await usersRepository.findById(evaluation.userId);
    const access = evaluatee ? getEvaluationAccess(viewer, evaluatee, evaluation) : 'NONE';
    if (access === 'NONE') throw evaluationNotFound();
    return { evaluation, access };
  }

  /** Lista de um avaliado específico, aplicando a política (e a ocultação) item a item. */
  async function listForUser(viewer: PolicyViewer, userId: number, cycle: string | undefined) {
    const evaluatee = await usersRepository.findById(userId);
    if (!evaluatee) throw userNotFound();
    // Escopo do USUÁRIO: o próprio viewer (EVALUATEE) ou liderado direto ativo (EVALUATOR numa
    // avaliação hipotética aberta pelo viewer). O resto é "não encontrado" (RBAC-03).
    if (getEvaluationAccess(viewer, evaluatee, { managerId: viewer.id }) === 'NONE') throw userNotFound();

    const evaluations = await evaluationsRepository.listByUserId(userId, { cycle });
    // Ex.: G com ?userId=C1 NÃO vê a avaliação de C1 aberta por um ex-gestor (D-07).
    return evaluations.flatMap((evaluation) => {
      const access = getEvaluationAccess(viewer, evaluatee, evaluation);
      return access === 'NONE' ? [] : [toEvaluationDTO(evaluation, access)];
    });
  }

  return {
    async createEvaluation(viewer, { userId, cycle }) {
      if (userId === viewer.id) throw forbidden(); // ninguém abre a própria avaliação (§4.1)

      // O alvo precisa ser liderado direto ATIVO do viewer: é exatamente o papel EVALUATOR
      // que o viewer teria numa avaliação aberta por ele (managerId = viewer).
      const evaluatee = await usersRepository.findById(userId);
      if (!evaluatee || getEvaluationAccess(viewer, evaluatee, { managerId: viewer.id }) !== 'EVALUATOR') {
        throw userNotFound();
      }

      try {
        const created = await evaluationsRepository.create({ userId, managerId: viewer.id, cycle });
        return toEvaluationDTO(created, 'EVALUATOR');
      } catch (error) {
        if (error instanceof DuplicateEvaluationError) throw alreadyExists(); // EVAL-INV-01 / EVAL-08
        throw error;
      }
    },

    async listEvaluations(viewer, { userId, cycle }) {
      if (userId !== undefined) return listForUser(viewer, userId, cycle);

      // Sem userId: gestor vê a EQUIPE (Q-02); colaborador vê as próprias.
      if (viewer.role === 'GESTOR') {
        const team = await evaluationsRepository.listByManagerId(viewer.id, { cycle });
        return team.map((evaluation) => toEvaluationDTO(evaluation, 'EVALUATOR'));
      }
      const own = await evaluationsRepository.listByUserId(viewer.id, { cycle });
      return own.map((evaluation) => toEvaluationDTO(evaluation, 'EVALUATEE'));
    },

    async getEvaluation(viewer, evaluationId) {
      const { evaluation, access } = await loadVisible(viewer, evaluationId);
      return toEvaluationDTO(evaluation, access);
    },

    async updateEvaluation(viewer, evaluationId, input) {
      const { evaluation, access } = await loadVisible(viewer, evaluationId); // 404

      const part: EvaluationPart = access === 'EVALUATEE' ? 'SELF' : 'MANAGER';
      const otherPart: EvaluationPart = part === 'SELF' ? 'MANAGER' : 'SELF';
      // 403 inteiro se houver QUALQUER campo da outra parte (payload misto: tudo ou nada).
      if (PART_FIELDS[otherPart].some((field) => input[field] !== undefined)) throw forbidden();

      const next = applyEvaluationChanges(evaluation, part, input, now()); // 409 / 400 (EVR-03)

      const updated = await evaluationsRepository.update(evaluationId, diff(evaluation, next));
      if (!updated) throw evaluationNotFound();
      // A ocultação é recalculada sobre o estado NOVO: o envio que conclui já revela (EVAL-22).
      return toEvaluationDTO(updated, access);
    },
  };
}
