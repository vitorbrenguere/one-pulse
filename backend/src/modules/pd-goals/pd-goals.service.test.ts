import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRecord } from '../users/user.types.js';
import { createPdGoalsService, type PdGoalsService } from './pd-goals.service.js';
import type { GoalRecord, NewGoal, PdGoalsRepository } from './pd-goals.types.js';

const PAST_DATE_ERROR = {
  statusCode: 400,
  code: 'VALIDATION_ERROR',
  details: [{ field: 'targetDate', message: 'Prazo não pode estar no passado.' }],
};

const ana: UserRecord = {
  id: 2,
  name: 'Ana Souza',
  email: 'ana@onepulse.dev',
  passwordHash: '$2b$04$hash.que.nunca.sai.na.api',
  role: 'COLABORADOR',
  managerId: 1,
  jobTitle: null,
  isActive: true,
  createdAt: new Date('2026-11-01T12:00:00.000Z'),
  updatedAt: new Date('2026-11-01T12:00:00.000Z'),
};
const viewer = { id: ana.id, role: ana.role };

function goalRecord(overrides: Partial<GoalRecord> = {}): GoalRecord {
  return {
    id: 10,
    userId: ana.id,
    createdBy: ana.id,
    title: 'Aprender testes',
    description: null,
    category: 'TECNICA',
    status: 'NAO_INICIADA',
    progress: 0,
    targetDate: '2099-12-31',
    completedAt: null,
    managerFeedback: null,
    managerFeedbackAt: null,
    createdAt: new Date('2026-11-01T12:00:00.000Z'),
    updatedAt: new Date('2026-11-01T12:00:00.000Z'),
    ...overrides,
  };
}

describe('PdGoalsService', () => {
  let goalsRepository: { [K in keyof PdGoalsRepository]: ReturnType<typeof vi.fn<PdGoalsRepository[K]>> };
  let usersRepository: { findById: ReturnType<typeof vi.fn<(id: number) => Promise<UserRecord | null>>> };
  let clock: Date;
  let service: PdGoalsService;

  beforeEach(() => {
    clock = new Date('2026-11-24T12:00:00.000Z');
    const stored = goalRecord();
    goalsRepository = {
      create: vi.fn<PdGoalsRepository['create']>(async (data: NewGoal) =>
        goalRecord({ ...data, id: 11, createdAt: clock, updatedAt: clock }),
      ),
      findById: vi.fn<PdGoalsRepository['findById']>(async (id) => (id === stored.id ? stored : null)),
      listByUserId: vi.fn<PdGoalsRepository['listByUserId']>(async () => [stored]),
      update: vi.fn<PdGoalsRepository['update']>(async (_id, changes) => {
        const updated = { ...stored };
        for (const [key, value] of Object.entries(changes)) {
          if (value !== undefined) Object.assign(updated, { [key]: value });
        }
        return updated;
      }),
      deleteIfNotStarted: vi.fn<PdGoalsRepository['deleteIfNotStarted']>(async () => true),
    };
    usersRepository = { findById: vi.fn(async (id: number) => (id === ana.id ? ana : null)) };
    service = createPdGoalsService({ goalsRepository, usersRepository, now: () => clock });
  });

  describe('regra "prazo ≥ hoje em UTC" (spec 03 §2.6)', () => {
    const create = (targetDate: string) =>
      service.createGoal(viewer, { title: 'Aprender testes', category: 'TECNICA', targetDate });

    it('[GOAL-28] criação com prazo ONTEM → 400 no campo targetDate, sem persistir', async () => {
      await expect(create('2026-11-23')).rejects.toMatchObject(PAST_DATE_ERROR);
      expect(goalsRepository.create).not.toHaveBeenCalled();
    });

    it.each(['2026-11-24', '2026-11-25'])('[GOAL-28] criação com prazo %s (hoje / amanhã) → aceita', async (date) => {
      await expect(create(date)).resolves.toMatchObject({ targetDate: date, status: 'NAO_INICIADA', progress: 0 });
      expect(goalsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ targetDate: date, userId: ana.id, createdBy: ana.id }),
      );
    });

    it('[GOAL-28] "hoje" é o dia em UTC: às 01h UTC do dia 25 (22h do dia 24 em Brasília), 24/11 já é passado', async () => {
      clock = new Date('2026-11-25T01:00:00.000Z');

      await expect(create('2026-11-24')).rejects.toMatchObject(PAST_DATE_ERROR);
    });

    it('[GOAL-28] às 23:59:59.999 UTC, o próprio dia ainda é aceito', async () => {
      clock = new Date('2026-11-24T23:59:59.999Z');

      await expect(create('2026-11-24')).resolves.toMatchObject({ targetDate: '2026-11-24' });
    });

    it('[GOAL-28] edição com prazo ONTEM → 400, sem persistir', async () => {
      await expect(service.updateGoal(viewer, 10, { targetDate: '2026-11-23' })).rejects.toMatchObject(PAST_DATE_ERROR);
      expect(goalsRepository.update).not.toHaveBeenCalled();
    });

    it('[GOAL-28] edição com prazo HOJE → aceita', async () => {
      await expect(service.updateGoal(viewer, 10, { targetDate: '2026-11-24' })).resolves.toMatchObject({
        targetDate: '2026-11-24',
      });
      expect(goalsRepository.update).toHaveBeenCalledWith(10, expect.objectContaining({ targetDate: '2026-11-24' }));
    });
  });

  describe('exclusão condicional (spec 03 §4.5, D-10)', () => {
    it('[GOAL-45] a linha mudou de status entre a leitura e o DELETE (affectedRows = 0) → 409 GOAL_NOT_DELETABLE', async () => {
      goalsRepository.deleteIfNotStarted.mockResolvedValueOnce(false);

      await expect(service.deleteGoal(viewer, 10)).rejects.toMatchObject({
        statusCode: 409,
        code: 'GOAL_NOT_DELETABLE',
      });
      expect(goalsRepository.deleteIfNotStarted).toHaveBeenCalledWith(10);
    });

    it('[GOAL-45] meta NAO_INICIADA do dono e DELETE bem-sucedido → resolve sem valor', async () => {
      await expect(service.deleteGoal(viewer, 10)).resolves.toBeUndefined();
      expect(goalsRepository.deleteIfNotStarted).toHaveBeenCalledWith(10);
    });

    it('[GOAL-45] meta já iniciada na leitura → 409 sem nem tentar o DELETE', async () => {
      goalsRepository.findById.mockResolvedValueOnce(goalRecord({ status: 'EM_ANDAMENTO', progress: 40 }));

      await expect(service.deleteGoal(viewer, 10)).rejects.toMatchObject({ statusCode: 409, code: 'GOAL_NOT_DELETABLE' });
      expect(goalsRepository.deleteIfNotStarted).not.toHaveBeenCalled();
    });
  });
});
