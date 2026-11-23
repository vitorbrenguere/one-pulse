import { z } from 'zod';

/** Spec 01-auth §3. `strictObject` rejeita campos desconhecidos (proteção contra mass assignment). */

const NAME_MESSAGE = 'Nome deve ter entre 2 e 120 caracteres.';
const EMAIL_MESSAGE = 'E-mail inválido.';
const PASSWORD_MESSAGE = 'Senha deve ter entre 8 e 72 caracteres, com ao menos uma letra e um número.';
const BODY_MESSAGE = 'O corpo da requisição deve ser um objeto JSON.';

/** trim + lowercase ANTES de validar o formato (por isso o pipe). */
const emailField = () =>
  z.string({ error: EMAIL_MESSAGE }).trim().toLowerCase().max(255, EMAIL_MESSAGE).pipe(z.email(EMAIL_MESSAGE));

export const registerSchema = z.strictObject(
  {
    name: z.string({ error: NAME_MESSAGE }).trim().min(2, NAME_MESSAGE).max(120, NAME_MESSAGE),
    email: emailField(),
    // Sem trim: espaços fazem parte da senha. Máximo de 72 caracteres por causa do limite do bcrypt.
    password: z
      .string({ error: PASSWORD_MESSAGE })
      .min(8, PASSWORD_MESSAGE)
      .max(72, PASSWORD_MESSAGE)
      .regex(/\p{L}/u, PASSWORD_MESSAGE)
      .regex(/\d/, PASSWORD_MESSAGE),
  },
  { error: BODY_MESSAGE },
);

export const loginSchema = z.strictObject(
  {
    email: emailField(),
    // Sem política de força no login: ela vale só para criar senhas.
    password: z.string({ error: 'Senha é obrigatória.' }).min(1, 'Senha é obrigatória.').max(72, 'Senha inválida.'),
  },
  { error: BODY_MESSAGE },
);

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
