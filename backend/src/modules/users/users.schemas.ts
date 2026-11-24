import { z } from 'zod';
import { idParam } from '../../shared/schemas/id-param.js';

/** Spec 02 §3. */

const USER_ID_MESSAGE = 'ID de usuário inválido.';
const NAME_MESSAGE = 'Nome deve ter entre 2 e 120 caracteres.';
const JOB_TITLE_MESSAGE = 'Cargo deve ter entre 1 e 120 caracteres, ou null para remover.';

/** `:id` da URL (regra compartilhada em shared/schemas/id-param.ts, decisão D-05). */
export const userIdParamSchema = z.object({ id: idParam(USER_ID_MESSAGE) });

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
