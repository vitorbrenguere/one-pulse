import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRecord } from '../users/user.types.js';
import { createEvaluationsService, type EvaluationsService } from './evaluations.service.js';
import { DuplicateEvaluationError, type EvaluationRecord, type EvaluationsRepository } from './evaluations.types.js';

const NOW = new Date('2026-11-24T12:00:00.000Z');

function user(overrides: Partial<UserRecord>): UserRecord {
  return {
    id: 0,
    name: 'Usuário',
    email: 'usuario@onepulse.dev',
    passwordHash: '$2b$04$hash.que.nunca.sai.na.api',
    role: 'COLABORADOR',
    managerId: null,
    jobTitle: null,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

const gestora = user({ id: 1, name: 'Gabriela Martins', email: 'g@onepulse.dev', role: 'GESTOR' });
const liderado = user({ id: 2, name: 'Carlos Lima', email: 'c1@onepulse.dev', managerId: gestora.id });
const viewer = { id: gestora.id, role: gestora.role };

function evaluationRecord(overrides: Partial<EvaluationRecord> = {}): EvaluationRecord {
  return {
    id: 10,
    userId: liderado.id,
    managerId: gestora.id,
    cycle: '2026-S2',
    status: 'ABERTA',
    selfScore: null,
    selfComments: null,
    selfSubmittedAt: null,
    managerScore: null,
    managerFeedback: null,
    managerSubmittedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('EvaluationsService: abertura concorrente (spec 04 §2.8, D-01)', () => {
  let evaluationsRepository: { [K in keyof EvaluationsRepository]: ReturnType<typeof vi.fn<EvaluationsRepository[K]>> };
  let service: EvaluationsService;

  beforeEach(() => {
    evaluationsRepository = {
      create: vi.fn<EvaluationsRepository['create']>(async (data) => evaluationRecord({ ...data })),
      findById: vi.fn<EvaluationsRepository['findById']>(async () => null),
      listByUserId: vi.fn<EvaluationsRepository['listByUserId']>(async () => []),
      listByManagerId: vi.fn<EvaluationsRepository['listByManagerId']>(async () => []),
      update: vi.fn<EvaluationsRepository['update']>(async () => null),
    };
    const users = new Map([gestora, liderado].map((u) => [u.id, u]));
    const usersRepository = { findById: vi.fn(async (id: number) => users.get(id) ?? null) };
    service = createEvaluationsService({ evaluationsRepository, usersRepository, now: () => NOW });
  });

  it('[EVAL-08] o UNIQUE(user_id, cycle) é violado no INSERT (dois POSTs simultâneos) → 409, não 500', async () => {
    evaluationsRepository.create.mockRejectedValueOnce(new DuplicateEvaluationError());

    await expect(service.createEvaluation(viewer, { userId: liderado.id, cycle: '2026-S2' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'EVALUATION_ALREADY_EXISTS',
      message: 'Já existe uma avaliação deste colaborador para o ciclo informado.',
    });
    expect(evaluationsRepository.create).toHaveBeenCalledWith({
      userId: liderado.id,
      managerId: gestora.id,
      cycle: '2026-S2',
    });
  });

  it('[EVAL-08] outros erros do repository NÃO viram 409 (seguem para o 500 genérico)', async () => {
    const boom = new Error('conexão perdida');
    evaluationsRepository.create.mockRejectedValueOnce(boom);

    await expect(service.createEvaluation(viewer, { userId: liderado.id, cycle: '2026-S2' })).rejects.toBe(boom);
  });

  it('[EVAL-08] sem conflito, o managerId gravado vem do viewer (RBAC-04 / EVAL-INV-02)', async () => {
    await expect(service.createEvaluation(viewer, { userId: liderado.id, cycle: '2026-S2' })).resolves.toMatchObject({
      userId: liderado.id,
      managerId: gestora.id,
      status: 'ABERTA',
    });
  });
});
