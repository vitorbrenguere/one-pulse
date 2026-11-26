// Validação de UX espelhando a spec 01 §3.1, com as mesmas mensagens da API (spec 05 D-04).
// A API continua sendo a fonte da verdade: os `details[]` dela sempre são exibidos.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const MESSAGES = {
  name: 'Nome deve ter entre 2 e 120 caracteres.',
  email: 'E-mail inválido.',
  emailRequired: 'Informe o e-mail.',
  password: 'Senha deve ter entre 8 e 72 caracteres, com ao menos uma letra e um número.',
  passwordRequired: 'Informe a senha.',
} as const;

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

export function validateEmail(email: string): string | undefined {
  const value = email.trim();
  if (!value) return MESSAGES.emailRequired;
  if (value.length > 255 || !EMAIL_PATTERN.test(value)) return MESSAGES.email;
  return undefined;
}

export function validateLogin(values: { email: string; password: string }): FieldErrors<'email' | 'password'> {
  const errors: FieldErrors<'email' | 'password'> = {};
  const email = validateEmail(values.email);
  if (email) errors.email = email;
  if (!values.password) errors.password = MESSAGES.passwordRequired;
  return errors;
}

export function validateRegister(values: {
  name: string;
  email: string;
  password: string;
}): FieldErrors<'name' | 'email' | 'password'> {
  const errors: FieldErrors<'name' | 'email' | 'password'> = {};
  const name = values.name.trim();
  if (name.length < 2 || name.length > 120) errors.name = MESSAGES.name;
  if (validateEmail(values.email)) errors.email = MESSAGES.email;
  const { password } = values;
  if (password.length < 8 || password.length > 72 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = MESSAGES.password;
  }
  return errors;
}
