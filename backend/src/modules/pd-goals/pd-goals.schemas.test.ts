import { describe, expect, it } from 'vitest';
import {
  FAR_FUTURE,
  FORBIDDEN_CREATE_FIELDS,
  FORBIDDEN_UPDATE_FIELDS,
  INVALID_CREATE_BODIES,
  INVALID_GOAL_IDS,
  INVALID_LIST_QUERIES,
  INVALID_UPDATE_BODIES,
  VALID_CREATE_BODY,
  VALID_GOAL_IDS,
} from '../../../tests/fixtures/pd-goals.fixtures.js';
import { createGoalSchema, goalIdParamSchema, listGoalsQuerySchema, updateGoalSchema } from './pd-goals.schemas.js';

function issuePaths(result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[] }> } }): string[] {
  return (result.error?.issues ?? []).map((issue) => issue.path.map(String).join('.') || 'body');
}

describe('goalIdParamSchema', () => {
  it.each(VALID_GOAL_IDS)('[GOAL-19] aceita "%s" e converte para número', (raw, expected) => {
    const result = goalIdParamSchema.safeParse({ id: raw });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: expected });
  });

  it.each(INVALID_GOAL_IDS)('[GOAL-19] rejeita "%s"', (raw) => {
    const result = goalIdParamSchema.safeParse({ id: raw });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('id');
  });
});

describe('listGoalsQuerySchema', () => {
  it.each([
    ['query vazia', {}, {}],
    ['userId válido convertido para número', { userId: '42' }, { userId: 42 }],
    ['userId no limite de INT UNSIGNED', { userId: '4294967295' }, { userId: 4_294_967_295 }],
  ])('[GOAL-14] aceita %s', (_description, query, expected) => {
    const result = listGoalsQuerySchema.safeParse(query);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(expected);
  });

  it.each(INVALID_LIST_QUERIES)('[GOAL-14] rejeita %s', (_description, _queryString, query, field) => {
    const result = listGoalsQuerySchema.safeParse(query);

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain(field);
  });
});

describe('createGoalSchema', () => {
  it.each([
    [
      'o mínimo obrigatório, com trim no title',
      { ...VALID_CREATE_BODY, title: '  Aprender testes  ' },
      { title: 'Aprender testes', category: 'TECNICA', targetDate: FAR_FUTURE },
    ],
    [
      'description com trim',
      { ...VALID_CREATE_BODY, description: '  Cobrir a API  ' },
      { ...VALID_CREATE_BODY, description: 'Cobrir a API' },
    ],
    ['description null', { ...VALID_CREATE_BODY, description: null }, { ...VALID_CREATE_BODY, description: null }],
    ['title com 3 caracteres (após trim)', { ...VALID_CREATE_BODY, title: ' abc ' }, { ...VALID_CREATE_BODY, title: 'abc' }],
    [
      'title com 150 caracteres e description com 2000',
      { ...VALID_CREATE_BODY, title: ` ${'a'.repeat(150)} `, description: 'b'.repeat(2000) },
      { ...VALID_CREATE_BODY, title: 'a'.repeat(150), description: 'b'.repeat(2000) },
    ],
    [
      'userId numérico (criação para liderado)',
      { ...VALID_CREATE_BODY, title: ' Liderar retro ', userId: 2 },
      { ...VALID_CREATE_BODY, title: 'Liderar retro', userId: 2 },
    ],
    [
      'categoria COMPORTAMENTAL e 29/02 de ano bissexto',
      { title: ' Comunicação ', category: 'COMPORTAMENTAL', targetDate: '2028-02-29' },
      { title: 'Comunicação', category: 'COMPORTAMENTAL', targetDate: '2028-02-29' },
    ],
    [
      'data no passado (a regra "≥ hoje" é do service, D-09)',
      { title: ' Meta antiga ', category: 'CARREIRA', targetDate: '2000-01-01' },
      { title: 'Meta antiga', category: 'CARREIRA', targetDate: '2000-01-01' },
    ],
  ])('[GOAL-05] aceita %s', (_description, payload, expected) => {
    const result = createGoalSchema.safeParse(payload);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(expected);
  });

  it.each(INVALID_CREATE_BODIES)('[GOAL-05] rejeita %s', (_description, payload, field) => {
    const result = createGoalSchema.safeParse(payload);

    expect(result.success).toBe(false);
    if (field !== 'body') expect(issuePaths(result)).toContain(field);
  });

  it.each(FORBIDDEN_CREATE_FIELDS)('[GOAL-07] rejeita campo proibido "%s"', (field, payload) => {
    const result = createGoalSchema.safeParse(payload);

    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(expect.objectContaining({ code: 'unrecognized_keys', keys: [field] }));
  });
});

describe('updateGoalSchema', () => {
  it.each([
    ['title com trim', { title: '  Novo título ' }, { title: 'Novo título' }],
    ['description null remove', { description: null }, { description: null }],
    ['progress 0', { progress: 0 }, { progress: 0 }],
    ['progress 100', { progress: 100 }, { progress: 100 }],
    ['CONCLUIDA com progress 100', { status: 'CONCLUIDA', progress: 100 }, { status: 'CONCLUIDA', progress: 100 }],
    ['NAO_INICIADA com progress 0', { status: 'NAO_INICIADA', progress: 0 }, { status: 'NAO_INICIADA', progress: 0 }],
    ['EM_ANDAMENTO com progress 99', { status: 'EM_ANDAMENTO', progress: 99 }, { status: 'EM_ANDAMENTO', progress: 99 }],
    ['CANCELADA sem progress', { status: 'CANCELADA' }, { status: 'CANCELADA' }],
    ['managerFeedback com trim', { managerFeedback: '  Ótimo avanço.  ' }, { managerFeedback: 'Ótimo avanço.' }],
    ['managerFeedback null remove', { managerFeedback: null }, { managerFeedback: null }],
    ['managerFeedback com 2000 caracteres', { managerFeedback: 'a'.repeat(2000) }, { managerFeedback: 'a'.repeat(2000) }],
    [
      'payload misto (o schema aceita; quem pode o quê é decidido no service)',
      { title: ' Novo ', managerFeedback: ' Ok ' },
      { title: 'Novo', managerFeedback: 'Ok' },
    ],
  ])('[GOAL-37] aceita %s', (_description, payload, expected) => {
    const result = updateGoalSchema.safeParse(payload);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(expected);
  });

  it('[GOAL-37] campos omitidos NÃO aparecem no resultado (não sobrescrevem com undefined)', () => {
    const result = updateGoalSchema.safeParse({ progress: 10 });

    expect(result.success).toBe(true);
    expect(Object.keys(result.data ?? {})).toEqual(['progress']);
  });

  it.each(INVALID_UPDATE_BODIES)('[GOAL-37] rejeita %s', (_description, payload, field) => {
    const result = updateGoalSchema.safeParse(payload);

    expect(result.success).toBe(false);
    if (field !== 'body') expect(issuePaths(result)).toContain(field);
  });

  it.each(FORBIDDEN_UPDATE_FIELDS)('[GOAL-37] rejeita campo proibido "%s"', (field, payload) => {
    const result = updateGoalSchema.safeParse(payload);

    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(expect.objectContaining({ code: 'unrecognized_keys', keys: [field] }));
  });
});
