import { notImplemented } from '../../shared/utils/not-implemented.js';
import type { UsersRepository } from '../users/user.types.js';
import type { PolicyViewer } from '../users/users.policy.js';
import type { CreateEvaluationInput, ListEvaluationsQuery, UpdateEvaluationInput } from './evaluations.schemas.js';
import type { EvaluationDTO, EvaluationsRepository } from './evaluations.types.js';

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

/** ⚠️ STUB da etapa RED: todos os métodos rejeitam com NotImplementedError. */
export function createEvaluationsService(_deps: EvaluationsServiceDeps): EvaluationsService {
  return {
    createEvaluation: async () => notImplemented('EvaluationsService.createEvaluation'),
    listEvaluations: async () => notImplemented('EvaluationsService.listEvaluations'),
    getEvaluation: async () => notImplemented('EvaluationsService.getEvaluation'),
    updateEvaluation: async () => notImplemented('EvaluationsService.updateEvaluation'),
  };
}
