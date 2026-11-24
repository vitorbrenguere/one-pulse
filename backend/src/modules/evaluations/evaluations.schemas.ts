import { z } from 'zod';
import { idParam, INT_UNSIGNED_MAX } from '../../shared/schemas/id-param.js';

/** Spec 04 §3. */

const EVALUATION_ID_MESSAGE = 'ID de avaliação inválido.';
const USER_ID_MESSAGE = 'ID de usuário inválido.';
const CYCLE_MESSAGE = 'Ciclo deve estar no formato AAAA-S1 ou AAAA-S2.';
const SCORE_MESSAGE = 'Nota deve ser um número inteiro de 1 a 5, ou null para limpar.';
const COMMENTS_MESSAGE = 'Comentário deve ter entre 1 e 2000 caracteres, ou null para limpar.';
const FEEDBACK_MESSAGE = 'Feedback deve ter entre 1 e 2000 caracteres, ou null para limpar.';
const SUBMIT_MESSAGE = 'Para enviar, use submit: true; para salvar rascunho, omita o campo.';
const NOT_AN_OBJECT_MESSAGE = 'O corpo da requisição deve ser um objeto JSON.';

/**
 * Ciclo semestral `AAAA-SN` com ano de 2000 a 2099 (spec 00 §5 item 2, Q-04).
 * Sem `trim` nem normalização de caixa: " 2026-S1" e "2026-s1" são erros, não "quase certos".
 */
const cycle = z.string({ error: CYCLE_MESSAGE }).regex(/^20\d{2}-S[12]$/, CYCLE_MESSAGE);

/** `null` limpa a nota do rascunho; inteiro de 1 a 5 (escala da D-08). */
const score = z
  .number({ error: SCORE_MESSAGE })
  .int(SCORE_MESSAGE)
  .min(1, SCORE_MESSAGE)
  .max(5, SCORE_MESSAGE)
  .nullable();

/** `null` limpa; "" e "   " são inválidos (sem conversão implícita, spec 02 D-07). */
const text = (message: string) => z.string({ error: message }).trim().min(1, message).max(2000, message).nullable();

/** Um `catchall` que sempre falha: parâmetro extra → issue com o nome dele no `path` (spec 03 §3.2). */
const unknownQueryParam = z.custom<unknown>(() => false, { error: 'Parâmetro não permitido.' });

// ---------------------------------------------------------------------------

/** §3.1: `:id` da avaliação. */
export const evaluationIdParamSchema = z.object({ id: idParam(EVALUATION_ID_MESSAGE) });

/** §3.2: query do GET /evaluations (estrita). */
export const listEvaluationsQuerySchema = z
  .object({ userId: idParam(USER_ID_MESSAGE).optional(), cycle: cycle.optional() })
  .catchall(unknownQueryParam);

/** §3.3: POST /evaluations. O `managerId` vem SEMPRE do JWT (RBAC-04): no corpo, é mass assignment. */
export const createEvaluationSchema = z.strictObject(
  {
    userId: z
      .number({ error: USER_ID_MESSAGE })
      .int(USER_ID_MESSAGE)
      .positive(USER_ID_MESSAGE)
      .max(INT_UNSIGNED_MAX, USER_ID_MESSAGE),
    cycle,
  },
  { error: NOT_AN_OBJECT_MESSAGE },
);

/**
 * §3.4: PATCH /evaluations/:id. O schema aceita campos das DUAS partes; quem pode o quê é
 * decidido no service, depois do 404 (§2.7), para o 403 não revelar a existência da avaliação.
 */
export const updateEvaluationSchema = z
  .strictObject(
    {
      selfScore: score.optional(),
      selfComments: text(COMMENTS_MESSAGE).optional(),
      managerScore: score.optional(),
      managerFeedback: text(FEEDBACK_MESSAGE).optional(),
      // Só o literal true: `submit: false` não teria significado diferente de omitir o campo.
      submit: z.literal(true, { error: SUBMIT_MESSAGE }).optional(),
    },
    { error: NOT_AN_OBJECT_MESSAGE },
  )
  .refine((data) => Object.keys(data).length > 0, { error: 'Informe ao menos um campo para atualizar.' });

export type EvaluationIdParam = z.infer<typeof evaluationIdParamSchema>;
export type ListEvaluationsQuery = z.infer<typeof listEvaluationsQuerySchema>;
export type CreateEvaluationInput = z.infer<typeof createEvaluationSchema>;
export type UpdateEvaluationInput = z.infer<typeof updateEvaluationSchema>;
