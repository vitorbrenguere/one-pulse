import { AppError, forbidden } from '../../shared/errors/app-error.js';
import type { UserRecord, UsersRepository } from '../users/user.types.js';
import type { PolicyViewer } from '../users/users.policy.js';
import { toGoalDTO } from './pd-goals.mapper.js';
import { getGoalAccess } from './pd-goals.policy.js';
import { applyGoalChanges } from './pd-goals.rules.js';
import type { CreateGoalInput, ListGoalsQuery, UpdateGoalInput } from './pd-goals.schemas.js';
import type { GoalAccess, GoalDTO, GoalRecord, GoalUpdate, OwnerGoalChanges, PdGoalsRepository } from './pd-goals.types.js';

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

// ---- Erros (spec 03 §2.7 / §2.9): corpos ÚNICOS para "não existe" e "não é seu" (RBAC-03) ----
const goalNotFound = () => new AppError(404, 'NOT_FOUND', 'Meta não encontrada.');
const userNotFound = () => new AppError(404, 'NOT_FOUND', 'Usuário não encontrado.');
const goalNotDeletable = () =>
  new AppError(
    409,
    'GOAL_NOT_DELETABLE',
    'Apenas metas não iniciadas podem ser excluídas. Para encerrar esta meta, altere o status para CANCELADA.',
  );
const pastTargetDate = () =>
  new AppError(400, 'VALIDATION_ERROR', 'Dados inválidos.', [
    { field: 'targetDate', message: 'Prazo não pode estar no passado.' },
  ]);

/** "Hoje" é o dia em UTC (§2.6); datas AAAA-MM-DD se comparam corretamente como string. */
function assertNotInPast(targetDate: string | undefined, now: Date): void {
  if (targetDate !== undefined && targetDate < now.toISOString().slice(0, 10)) throw pastTargetDate();
}

/**
 * Separa o payload por "dono do campo" (§3.4): `managerFeedback` é do GESTOR; todo o resto é
 * do DONO. O schema já omite as chaves ausentes, então `ownerChanges` só tem o que foi enviado.
 */
function splitByRole(input: UpdateGoalInput): { ownerChanges: OwnerGoalChanges; managerFeedback: string | null | undefined } {
  const { managerFeedback, ...ownerChanges } = input;
  return { ownerChanges, managerFeedback };
}

const hasAnyField = (changes: OwnerGoalChanges) => Object.values(changes).some((value) => value !== undefined);

const sameInstant = (a: Date | null, b: Date | null) => (a?.getTime() ?? null) === (b?.getTime() ?? null);

export function createPdGoalsService(deps: PdGoalsServiceDeps): PdGoalsService {
  const { goalsRepository, usersRepository, now } = deps;

  /** Papel do viewer em relação a um usuário; inexistente equivale a fora do escopo. */
  async function accessToUser(viewer: PolicyViewer, userId: number): Promise<GoalAccess> {
    const owner: UserRecord | null = await usersRepository.findById(userId);
    return owner ? getGoalAccess(viewer, owner) : 'NONE';
  }

  /**
   * Carrega a meta e o papel do viewer nela. O dono é relido A CADA requisição: se o liderado
   * trocar de gestor ou for desativado, o acesso do gestor some na hora (§2.1).
   */
  async function loadVisibleGoal(viewer: PolicyViewer, goalId: number) {
    const goal = await goalsRepository.findById(goalId);
    if (!goal) throw goalNotFound();
    const access = await accessToUser(viewer, goal.userId);
    if (access === 'NONE') throw goalNotFound();
    return { goal, access };
  }

  /** Dono: aplica a máquina de estados e grava só o que de fato mudou. */
  function ownerUpdate(goal: GoalRecord, input: UpdateGoalInput): GoalUpdate {
    const { ownerChanges: changes, managerFeedback } = splitByRole(input);
    if (managerFeedback !== undefined) throw forbidden(); // GOAL-32: o parecer não é do dono
    const next = applyGoalChanges(goal, changes, now()); // 409 GOAL_LOCKED / INVALID_STATUS_TRANSITION

    const update: GoalUpdate = {};
    if (changes.title !== undefined) update.title = changes.title;
    if (changes.description !== undefined) update.description = changes.description;
    if (changes.category !== undefined) update.category = changes.category;
    if (changes.targetDate !== undefined) update.targetDate = changes.targetDate;
    if (next.status !== goal.status) update.status = next.status;
    if (next.progress !== goal.progress) update.progress = next.progress;
    if (!sameInstant(next.completedAt, goal.completedAt)) update.completedAt = next.completedAt;
    return update;
  }

  /** Gestor direto: só o parecer, inclusive em meta terminal (D-05). Payload misto → 403 inteiro. */
  function managerUpdate(input: UpdateGoalInput): GoalUpdate {
    const { ownerChanges, managerFeedback } = splitByRole(input);
    if (hasAnyField(ownerChanges) || managerFeedback === undefined) throw forbidden();
    return { managerFeedback, managerFeedbackAt: managerFeedback === null ? null : now() };
  }

  return {
    async createGoal(viewer, input) {
      assertNotInPast(input.targetDate, now());

      const ownerId = input.userId ?? viewer.id;
      // OWNER (para si) ou MANAGER (para o liderado direto). Qualquer outro alvo → 404 de usuário.
      if ((await accessToUser(viewer, ownerId)) === 'NONE') throw userNotFound();

      const created = await goalsRepository.create({
        userId: ownerId,
        createdBy: viewer.id, // sempre do JWT (RBAC-04), nunca do corpo
        title: input.title,
        description: input.description ?? null,
        category: input.category,
        targetDate: input.targetDate,
      });
      return toGoalDTO(created);
    },

    async listGoals(viewer, query) {
      const ownerId = query.userId ?? viewer.id;
      if ((await accessToUser(viewer, ownerId)) === 'NONE') throw userNotFound();
      const goals = await goalsRepository.listByUserId(ownerId);
      return goals.map(toGoalDTO);
    },

    async getGoal(viewer, goalId) {
      const { goal } = await loadVisibleGoal(viewer, goalId);
      return toGoalDTO(goal);
    },

    async updateGoal(viewer, goalId, input) {
      // 400 primeiro: depende só da entrada e do relógio, não revela nada sobre a meta (§2.8).
      assertNotInPast(input.targetDate, now());

      const { goal, access } = await loadVisibleGoal(viewer, goalId); // 404
      const changes = access === 'OWNER' ? ownerUpdate(goal, input) : managerUpdate(input); // 403 / 409

      const updated = await goalsRepository.update(goalId, changes);
      if (!updated) throw goalNotFound(); // excluída entre a leitura e a escrita
      return toGoalDTO(updated);
    },

    async deleteGoal(viewer, goalId) {
      const { goal, access } = await loadVisibleGoal(viewer, goalId); // 404
      if (access !== 'OWNER') throw forbidden(); // GOAL-42: nem o gestor que criou a meta exclui
      if (goal.status !== 'NAO_INICIADA') throw goalNotDeletable();
      // D-10: a condição também está no SQL; affectedRows = 0 → alguém iniciou a meta no meio.
      if (!(await goalsRepository.deleteIfNotStarted(goalId))) throw goalNotDeletable();
    },
  };
}
