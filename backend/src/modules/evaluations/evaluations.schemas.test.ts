import { describe, expect, it } from 'vitest';
import {
  FORBIDDEN_CREATE_FIELDS,
  FORBIDDEN_UPDATE_FIELDS,
  INVALID_CREATE_BODIES,
  INVALID_EVALUATION_IDS,
  INVALID_LIST_QUERIES,
  INVALID_UPDATE_BODIES,
  VALID_CYCLES,
  VALID_EVALUATION_IDS,
} from '../../../tests/fixtures/evaluations.fixtures.js';
import {
  createEvaluationSchema,
  evaluationIdParamSchema,
  listEvaluationsQuerySchema,
  updateEvaluationSchema,
} from './evaluations.schemas.js';

function issuePaths(result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[] }> } }): string[] {
  return (result.error?.issues ?? []).map((issue) => issue.path.map(String).join('.') || 'body');
}

describe('evaluationIdParamSchema', () => {
  it.each(VALID_EVALUATION_IDS)('[EVAL-19] aceita "%s" e converte para número', (raw, expected) => {
    const result = evaluationIdParamSchema.safeParse({ id: raw });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id: expected });
  });

  it.each(INVALID_EVALUATION_IDS)('[EVAL-19] rejeita "%s"', (raw) => {
    const result = evaluationIdParamSchema.safeParse({ id: raw });

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('id');
  });
});

describe('listEvaluationsQuerySchema', () => {
  it.each([
    ['query vazia', {}, {}],
    ['userId convertido para número', { userId: '42' }, { userId: 42 }],
    ['cycle válido', { cycle: '2026-S2' }, { cycle: '2026-S2' }],
    ['userId e cycle juntos', { userId: '7', cycle: '2026-S1' }, { userId: 7, cycle: '2026-S1' }],
  ])('[EVAL-14] aceita %s', (_description, query, expected) => {
    const result = listEvaluationsQuerySchema.safeParse(query);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(expected);
  });

  it.each(INVALID_LIST_QUERIES)('[EVAL-14] rejeita %s', (_description, _queryString, query, field) => {
    const result = listEvaluationsQuerySchema.safeParse(query);

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain(field);
  });
});

describe('createEvaluationSchema', () => {
  it.each(VALID_CYCLES)('[EVAL-05] aceita o ciclo "%s"', (cycle) => {
    const result = createEvaluationSchema.safeParse({ userId: 2, cycle });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ userId: 2, cycle });
  });

  it('[EVAL-05] aceita userId no limite de INT UNSIGNED', () => {
    const result = createEvaluationSchema.safeParse({ userId: 4_294_967_295, cycle: '2026-S2' });

    expect(result.success).toBe(true);
  });

  it.each(INVALID_CREATE_BODIES)('[EVAL-05] rejeita %s', (_description, payload, field) => {
    const result = createEvaluationSchema.safeParse(payload);

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain(field);
  });

  it.each(FORBIDDEN_CREATE_FIELDS)('[EVAL-06] rejeita campo proibido "%s"', (field, payload) => {
    const result = createEvaluationSchema.safeParse(payload);

    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(expect.objectContaining({ code: 'unrecognized_keys', keys: [field] }));
  });
});

describe('updateEvaluationSchema', () => {
  it.each([
    ['selfScore 1', { selfScore: 1 }, { selfScore: 1 }],
    ['selfScore 5', { selfScore: 5 }, { selfScore: 5 }],
    ['selfScore null limpa', { selfScore: null }, { selfScore: null }],
    ['selfComments com trim', { selfComments: '  Entreguei a API.  ' }, { selfComments: 'Entreguei a API.' }],
    ['selfComments null limpa', { selfComments: null }, { selfComments: null }],
    ['managerScore e managerFeedback com trim', { managerScore: 3, managerFeedback: ' Bom ritmo. ' }, { managerScore: 3, managerFeedback: 'Bom ritmo.' }],
    ['managerFeedback com 2000 caracteres', { managerFeedback: 'a'.repeat(2000) }, { managerFeedback: 'a'.repeat(2000) }],
    ['submit sozinho (envia o rascunho salvo)', { submit: true }, { submit: true }],
    ['preencher e enviar no mesmo payload', { selfScore: 4, submit: true }, { selfScore: 4, submit: true }],
    [
      'payload misto (o schema aceita; quem pode o quê é decidido no service)',
      { selfScore: 4, managerScore: 2 },
      { selfScore: 4, managerScore: 2 },
    ],
  ])('[EVAL-37] aceita %s', (_description, payload, expected) => {
    const result = updateEvaluationSchema.safeParse(payload);

    expect(result.success).toBe(true);
    expect(result.data).toEqual(expected);
  });

  it('[EVAL-37] campos omitidos NÃO aparecem no resultado (não sobrescrevem com undefined)', () => {
    const result = updateEvaluationSchema.safeParse({ selfScore: 3 });

    expect(result.success).toBe(true);
    expect(Object.keys(result.data ?? {})).toEqual(['selfScore']);
  });

  it.each(INVALID_UPDATE_BODIES)('[EVAL-37] rejeita %s', (_description, payload, field) => {
    const result = updateEvaluationSchema.safeParse(payload);

    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain(field);
  });

  it.each(FORBIDDEN_UPDATE_FIELDS)('[EVAL-37] rejeita campo proibido "%s"', (field, payload) => {
    const result = updateEvaluationSchema.safeParse(payload);

    expect(result.success).toBe(false);
    expect(result.error?.issues).toContainEqual(expect.objectContaining({ code: 'unrecognized_keys', keys: [field] }));
  });
});
