import type { EvaluationDTO, GoalDTO, UserDTO } from '../types/api';

let sequence = 1000;
const nextId = (): number => ++sequence;

export function makeUser(overrides: Partial<UserDTO> = {}): UserDTO {
  return {
    id: nextId(),
    name: 'Pessoa Teste',
    email: 'pessoa@onepulse.dev',
    role: 'COLABORADOR',
    managerId: null,
    jobTitle: null,
    createdAt: '2026-11-22T12:00:00.000Z',
    ...overrides,
  };
}

/** Notação da spec 05 §7: G = gestor com liderados L1 e L2; C1 = colaborador liderado de G. */
export const G = makeUser({
  id: 1,
  name: 'Gabriela Martins',
  email: 'gabriela@onepulse.dev',
  role: 'GESTOR',
  managerId: 50,
  jobTitle: 'Engineering Manager',
});

export const L1 = makeUser({
  id: 2,
  name: 'Camila Rocha',
  email: 'camila@onepulse.dev',
  managerId: G.id,
  jobTitle: 'Desenvolvedora Pleno',
});

export const L2 = makeUser({
  id: 3,
  name: 'Bruno Costa',
  email: 'bruno@onepulse.dev',
  managerId: G.id,
  jobTitle: 'Desenvolvedor Pleno',
});

export const C1 = makeUser({
  id: 10,
  name: 'Carlos Lima',
  email: 'carlos@onepulse.dev',
  managerId: G.id,
  jobTitle: 'Desenvolvedor Júnior',
});

export function makeGoal(overrides: Partial<GoalDTO> = {}): GoalDTO {
  const userId = overrides.userId ?? C1.id;
  return {
    id: nextId(),
    userId,
    createdBy: userId,
    title: 'Meta de teste',
    description: null,
    category: 'TECNICA',
    status: 'NAO_INICIADA',
    progress: 0,
    targetDate: '2099-12-31',
    completedAt: null,
    managerFeedback: null,
    managerFeedbackAt: null,
    createdAt: '2026-11-20T12:00:00.000Z',
    updatedAt: '2026-11-20T12:00:00.000Z',
    ...overrides,
  };
}

export function makeEvaluation(overrides: Partial<EvaluationDTO> = {}): EvaluationDTO {
  return {
    id: nextId(),
    userId: C1.id,
    managerId: G.id,
    cycle: '2026-S2',
    status: 'ABERTA',
    selfScore: null,
    selfComments: null,
    selfSubmittedAt: null,
    managerScore: null,
    managerFeedback: null,
    managerSubmittedAt: null,
    createdAt: '2026-11-20T12:00:00.000Z',
    updatedAt: '2026-11-20T12:00:00.000Z',
    ...overrides,
  };
}
