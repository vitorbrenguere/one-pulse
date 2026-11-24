import { z } from 'zod';
import { idParam, INT_UNSIGNED_MAX } from '../../shared/schemas/id-param.js';
import { GOAL_CATEGORIES, GOAL_STATUSES, type GoalStatus } from './pd-goals.types.js';

/** Spec 03 §3. */

const GOAL_ID_MESSAGE = 'ID de meta inválido.';
const USER_ID_MESSAGE = 'ID de usuário inválido.';
const TITLE_MESSAGE = 'Título deve ter entre 3 e 150 caracteres.';
const DESCRIPTION_MESSAGE = 'Descrição deve ter entre 1 e 2000 caracteres, ou null.';
const CATEGORY_MESSAGE = 'Categoria inválida.';
const TARGET_DATE_MESSAGE = 'Prazo deve ser uma data válida no formato AAAA-MM-DD.';
const STATUS_MESSAGE = 'Status inválido.';
const PROGRESS_MESSAGE = 'Progresso deve ser um número inteiro entre 0 e 100.';
const FEEDBACK_MESSAGE = 'Parecer deve ter entre 1 e 2000 caracteres, ou null para remover.';
const NOT_AN_OBJECT_MESSAGE = 'O corpo da requisição deve ser um objeto JSON.';

/**
 * Data de calendário REAL no formato AAAA-MM-DD. A regex garante o formato; o "ida e volta"
 * pelo `Date` garante que o dia existe (o JS transformaria 2026-02-30 em 2026-03-02).
 */
function isCalendarDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const title = z.string({ error: TITLE_MESSAGE }).trim().min(3, TITLE_MESSAGE).max(150, TITLE_MESSAGE);

/** `null` remove; "" e "   " são inválidos (sem conversão implícita, spec 02 D-07). */
const description = z
  .string({ error: DESCRIPTION_MESSAGE })
  .trim()
  .min(1, DESCRIPTION_MESSAGE)
  .max(2000, DESCRIPTION_MESSAGE)
  .nullable();

const category = z.enum(GOAL_CATEGORIES, { error: CATEGORY_MESSAGE });

/** A regra "≥ hoje" NÃO fica aqui: depende do relógio e é do service (D-09). */
const targetDate = z
  .string({ error: TARGET_DATE_MESSAGE })
  .regex(/^\d{4}-\d{2}-\d{2}$/, TARGET_DATE_MESSAGE)
  .refine(isCalendarDate, TARGET_DATE_MESSAGE);

const managerFeedback = z
  .string({ error: FEEDBACK_MESSAGE })
  .trim()
  .min(1, FEEDBACK_MESSAGE)
  .max(2000, FEEDBACK_MESSAGE)
  .nullable();

// ---------------------------------------------------------------------------

/** §3.1: `:id` da meta. */
export const goalIdParamSchema = z.object({ id: idParam(GOAL_ID_MESSAGE) });

/**
 * §3.2: query do GET /pd-goals. Estrito: parâmetro desconhecido vira 400.
 * Um `catchall` que SEMPRE falha, em vez de `strictObject`: o efeito é o mesmo (nenhuma chave
 * extra passa), mas cada parâmetro extra gera uma issue com o PRÓPRIO nome no `path`
 * (`?status=X` → path ["status"]), e não uma única issue `unrecognized_keys` na raiz.
 * (`catchall(z.never())` não serve: o Zod 4 o converte em modo estrito.)
 */
const unknownQueryParam = z.custom<unknown>(() => false, { error: 'Parâmetro não permitido.' });

export const listGoalsQuerySchema = z
  .object({ userId: idParam(USER_ID_MESSAGE).optional() })
  .catchall(unknownQueryParam);

/**
 * §3.3: POST /pd-goals. strictObject barra mass assignment: status, progress, createdBy... → 400.
 * `userId` é número JSON (não string): no corpo não há o problema da URL, onde tudo é texto.
 */
export const createGoalSchema = z.strictObject(
  {
    title,
    description: description.optional(),
    category,
    targetDate,
    userId: z
      .number({ error: USER_ID_MESSAGE })
      .int(USER_ID_MESSAGE)
      .positive(USER_ID_MESSAGE)
      .max(INT_UNSIGNED_MAX, USER_ID_MESSAGE)
      .optional(),
  },
  { error: NOT_AN_OBJECT_MESSAGE },
);

/**
 * §2.5: valores de `progress` aceitos JUNTO com cada `status` no mesmo payload.
 * `null` = progress precisa estar ausente.
 */
const PROGRESS_ALLOWED_WITH_STATUS: Record<GoalStatus, ((progress: number) => boolean) | null> = {
  NAO_INICIADA: (progress) => progress === 0,
  EM_ANDAMENTO: (progress) => progress <= 99,
  CONCLUIDA: (progress) => progress === 100,
  CANCELADA: null,
};

/** §3.4: PATCH /pd-goals/:id. Quem pode alterar cada campo é decidido no SERVICE (após o 404). */
export const updateGoalSchema = z
  .strictObject(
    {
      title: title.optional(),
      description: description.optional(),
      category: category.optional(),
      targetDate: targetDate.optional(),
      status: z.enum(GOAL_STATUSES, { error: STATUS_MESSAGE }).optional(),
      progress: z
        .number({ error: PROGRESS_MESSAGE })
        .int(PROGRESS_MESSAGE)
        .min(0, PROGRESS_MESSAGE)
        .max(100, PROGRESS_MESSAGE)
        .optional(),
      managerFeedback: managerFeedback.optional(),
    },
    { error: NOT_AN_OBJECT_MESSAGE },
  )
  .refine((data) => Object.keys(data).length > 0, { error: 'Informe ao menos um campo para atualizar.' })
  // Contradições status × progress são inválidas em QUALQUER estado da meta → 400 aqui (D-07).
  .refine(
    ({ status, progress }) => {
      if (status === undefined || progress === undefined) return true;
      const allowed = PROGRESS_ALLOWED_WITH_STATUS[status];
      return allowed !== null && allowed(progress);
    },
    { error: 'Progresso incompatível com o status informado.', path: ['progress'] },
  );

export type GoalIdParam = z.infer<typeof goalIdParamSchema>;
export type ListGoalsQuery = z.infer<typeof listGoalsQuerySchema>;
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
