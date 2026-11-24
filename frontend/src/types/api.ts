// Contratos da API (specs 01–04). Fonte única dos tipos de DTO no front-end.

export type UserRole = 'COLABORADOR' | 'GESTOR';

export interface UserDTO {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  managerId: number | null;
  jobTitle: string | null;
  createdAt: string;
}

export type GoalStatus = 'NAO_INICIADA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';
export type GoalCategory = 'TECNICA' | 'COMPORTAMENTAL' | 'CARREIRA';

export interface GoalDTO {
  id: number;
  userId: number;
  createdBy: number;
  title: string;
  description: string | null;
  category: GoalCategory;
  status: GoalStatus;
  progress: number;
  /** Data pura `AAAA-MM-DD` (spec 03 §2.6). */
  targetDate: string;
  completedAt: string | null;
  managerFeedback: string | null;
  managerFeedbackAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type EvaluationStatus = 'ABERTA' | 'CONCLUIDA';

export interface EvaluationDTO {
  id: number;
  userId: number;
  managerId: number;
  /** `AAAA-S1` | `AAAA-S2`. */
  cycle: string;
  status: EvaluationStatus;
  selfScore: number | null;
  selfComments: string | null;
  selfSubmittedAt: string | null;
  managerScore: number | null;
  managerFeedback: string | null;
  managerSubmittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: ApiErrorDetail[] };
}
