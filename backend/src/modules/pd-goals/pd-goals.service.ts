import { notImplemented } from '../../shared/utils/not-implemented.js';
import type { UsersRepository } from '../users/user.types.js';
import type { PolicyViewer } from '../users/users.policy.js';
import type { CreateGoalInput, ListGoalsQuery, UpdateGoalInput } from './pd-goals.schemas.js';
import type { GoalDTO, PdGoalsRepository } from './pd-goals.types.js';

export interface PdGoalsService {
  /** POST /pd-goals (spec 03 §4.1). */
  createGoal(viewer: PolicyViewer, input: CreateGoalInput): Promise<GoalDTO>;
  /** GET /pd-goals (spec 03 §4.2). */
  listGoals(viewer: PolicyViewer, query: ListGoalsQuery): Promise<GoalDTO[]>;
  /** GET /pd-goals/:id (spec 03 §4.3). */
  getGoal(viewer: PolicyViewer, goalId: number): Promise<GoalDTO>;
  /** PATCH /pd-goals/:id (spec 03 §4.4). */
  updateGoal(viewer: PolicyViewer, goalId: number, input: UpdateGoalInput): Promise<GoalDTO>;
  /** DELETE /pd-goals/:id (spec 03 §4.5). */
  deleteGoal(viewer: PolicyViewer, goalId: number): Promise<void>;
}

export interface PdGoalsServiceDeps {
  goalsRepository: PdGoalsRepository;
  usersRepository: Pick<UsersRepository, 'findById'>;
  /** Relógio injetado (spec 03 §2.6, D-09): os testes unitários fixam a data. */
  now: () => Date;
}

/** ⚠️ STUB da etapa RED: todos os métodos rejeitam com NotImplementedError. */
export function createPdGoalsService(_deps: PdGoalsServiceDeps): PdGoalsService {
  return {
    createGoal: async () => notImplemented('PdGoalsService.createGoal'),
    listGoals: async () => notImplemented('PdGoalsService.listGoals'),
    getGoal: async () => notImplemented('PdGoalsService.getGoal'),
    updateGoal: async () => notImplemented('PdGoalsService.updateGoal'),
    deleteGoal: async () => notImplemented('PdGoalsService.deleteGoal'),
  };
}
