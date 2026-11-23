import { describe, expect, it } from 'vitest';
import {
  INVALID_LOGIN_CASES,
  INVALID_REGISTER_BODY_CASES,
  INVALID_REGISTER_FIELD_CASES,
  MASS_ASSIGNMENT_CASES,
  VALID_LOGIN,
  VALID_REGISTER,
} from '../../../tests/fixtures/auth.fixtures.js';
import { loginSchema, registerSchema } from './auth.schemas.js';

function issuePaths(result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[] }> } }): string[] {
  return (result.error?.issues ?? []).map((issue) => issue.path.join('.'));
}

describe('registerSchema', () => {
  it('[AUTH-03] aceita payload válido e normaliza e-mail (trim + lowercase) e nome (trim)', () => {
    const result = registerSchema.safeParse({ name: '  Ana Souza ', email: '  Ana@OnePulse.DEV ', password: 'segura123' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Ana Souza', email: 'ana@onepulse.dev', password: 'segura123' });
  });

  it('[AUTH-05] NÃO aplica trim na senha (espaços fazem parte dela)', () => {
    const result = registerSchema.safeParse({ ...VALID_REGISTER, password: '  segura123  ' });

    expect(result.success).toBe(true);
    expect(result.data?.password).toBe('  segura123  ');
  });

  it.each([
    ['name com 2 caracteres', { ...VALID_REGISTER, name: 'Al' }],
    ['name com 120 caracteres', { ...VALID_REGISTER, name: 'a'.repeat(120) }],
    ['password com 8 caracteres', { ...VALID_REGISTER, password: 'abcdefg1' }],
    ['password com 72 caracteres', { ...VALID_REGISTER, password: `a1${'x'.repeat(70)}` }],
  ])('[AUTH-05] aceita valor de fronteira: %s', (_description, payload) => {
    expect(registerSchema.safeParse(payload).success).toBe(true);
  });

  it.each(INVALID_REGISTER_FIELD_CASES)('[AUTH-05] rejeita %s', (_description, payload, field) => {
    const result = registerSchema.safeParse(payload);

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain(field);
  });

  it.each(INVALID_REGISTER_BODY_CASES)('[AUTH-05] rejeita corpo inválido: %s', (_description, payload) => {
    expect(registerSchema.safeParse(payload).success).toBe(false);
  });

  it.each(MASS_ASSIGNMENT_CASES)('[AUTH-06] rejeita campo não permitido (%s)', (_description, payload) => {
    expect(registerSchema.safeParse(payload).success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('[AUTH-13] aceita payload válido e normaliza o e-mail', () => {
    const result = loginSchema.safeParse({ email: ' ANA@onepulse.dev', password: 'segura123' });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ email: 'ana@onepulse.dev', password: 'segura123' });
  });

  it('[AUTH-14] NÃO aplica a política de força de senha no login', () => {
    expect(loginSchema.safeParse({ ...VALID_LOGIN, password: 'a' }).success).toBe(true);
  });

  it.each(INVALID_LOGIN_CASES)('[AUTH-14] rejeita %s', (_description, payload) => {
    expect(loginSchema.safeParse(payload).success).toBe(false);
  });
});
