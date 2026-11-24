import { describe, expect, it } from 'vitest';
import {
  FORBIDDEN_PROFILE_FIELDS,
  INVALID_PROFILE_BODIES,
  INVALID_USER_IDS,
  VALID_USER_IDS,
} from '../../../tests/fixtures/users.fixtures.js';
import { updateProfileSchema, userIdParamSchema } from './users.schemas.js';

function issuePaths(result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[] }> } }): string[] {
  return (result.error?.issues ?? []).map((issue) => issue.path.map(String).join('.'));
}

describe('userIdParamSchema', () => {
  it.each(VALID_USER_IDS)('[USER-15] aceita "%s" e converte para número', (raw, expected) => {
    const result = userIdParamSchema.safeParse({ id: raw });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: expected });
  });

  it.each(INVALID_USER_IDS)('[USER-15] rejeita "%s"', (raw) => {
    const result = userIdParamSchema.safeParse({ id: raw });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('id');
  });
});

describe('updateProfileSchema', () => {
  it.each([
    ['somente name (com trim)', { name: '  Ana Lima ' }, { name: 'Ana Lima' }],
    ['somente jobTitle (com trim)', { jobTitle: ' Dev Júnior ' }, { jobTitle: 'Dev Júnior' }],
    ['jobTitle null remove o cargo', { jobTitle: null }, { jobTitle: null }],
    ['name e jobTitle', { name: 'Ana Lima', jobTitle: 'Dev' }, { name: 'Ana Lima', jobTitle: 'Dev' }],
    ['jobTitle com 120 caracteres', { jobTitle: 'a'.repeat(120) }, { jobTitle: 'a'.repeat(120) }],
  ])('[USER-18] aceita %s', (_description, payload, expected) => {
    const result = updateProfileSchema.safeParse(payload);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(expected);
  });

  it('[USER-20] campos omitidos NÃO aparecem no resultado (não sobrescrevem com undefined)', () => {
    const result = updateProfileSchema.safeParse({ name: 'Ana Lima' });

    expect(result.success).toBe(true);
    expect(Object.keys(result.data ?? {})).toEqual(['name']);
  });

  it.each(INVALID_PROFILE_BODIES)('[USER-22] rejeita %s', (_description, payload, field) => {
    const result = updateProfileSchema.safeParse(payload);

    expect(result.success).toBe(false);
    if (field !== 'body') expect(issuePaths(result)).toContain(field);
  });

  it.each(FORBIDDEN_PROFILE_FIELDS)('[USER-21] rejeita campo proibido "%s"', (_field, payload) => {
    expect(updateProfileSchema.safeParse(payload).success).toBe(false);
  });
});
