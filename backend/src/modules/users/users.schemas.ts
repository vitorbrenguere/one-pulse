import { z } from 'zod';

/** Spec 02 §3. */

const INT_UNSIGNED_MAX = 4_294_967_295;
const USER_ID_MESSAGE = 'ID de usuário inválido.';
const NAME_MESSAGE = 'Nome deve ter entre 2 e 120 caracteres.';
const JOB_TITLE_MESSAGE = 'Cargo deve ter entre 1 e 120 caracteres, ou null para remover.';

/**
 * `:id` da URL. Regex explícita em vez de `z.coerce.number()`, que aceitaria
 * "1e3" (1000), " 1" (1) e "0x10" (16) como ids válidos (decisão D-05).
 */
export const userIdParamSchema = z.object({
  id: z
    .string({ error: USER_ID_MESSAGE })
    .regex(/^[1-9]\d{0,9}$/, USER_ID_MESSAGE)
    .transform(Number)
    .refine((id) => id <= INT_UNSIGNED_MAX, USER_ID_MESSAGE),
});

export const updateProfileSchema = z
  .strictObject(
    {
      name: z.string({ error: NAME_MESSAGE }).trim().min(2, NAME_MESSAGE).max(120, NAME_MESSAGE).optional(),
      // null remove o cargo; "" e "   " são inválidos (decisão D-07: sem conversão implícita)
      jobTitle: z
        .string({ error: JOB_TITLE_MESSAGE })
        .trim()
        .min(1, JOB_TITLE_MESSAGE)
        .max(120, JOB_TITLE_MESSAGE)
        .nullable()
        .optional(),
    },
    { error: 'O corpo da requisição deve ser um objeto JSON.' },
  )
  .refine((data) => Object.keys(data).length > 0, { error: 'Informe ao menos um campo para atualizar.' });

export type UserIdParam = z.infer<typeof userIdParamSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
