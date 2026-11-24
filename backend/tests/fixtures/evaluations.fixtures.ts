/**
 * Casos compartilhados entre os testes unitários (schemas) e de integração (HTTP) da spec 04.
 * Formato das tabelas: [descrição, entrada, campo esperado em details[].field].
 */

export const VALID_CYCLE = '2026-S2';

/** Base para corpos inválidos: o userId é um id bem formado (a validação vem antes do escopo). */
const BASE_CREATE_BODY = { userId: 1, cycle: VALID_CYCLE } as const;

function without<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

/** Ciclos aceitos pelo schema (spec 04 §2.1: ano entre 2000 e 2099, semestre 1 ou 2). */
export const VALID_CYCLES: readonly string[] = ['2000-S1', '2026-S1', '2026-S2', '2099-S2'];

/** EVAL-19: :id inválidos na URL. */
export const INVALID_EVALUATION_IDS: readonly string[] = ['abc', '0', '-1', '1.5', '1e3', '01', '4294967296'];

export const VALID_EVALUATION_IDS: ReadonlyArray<readonly [string, number]> = [
  ['1', 1],
  ['42', 42],
  ['4294967295', 4_294_967_295],
];

/** EVAL-05: corpos inválidos no POST /evaluations. */
export const INVALID_CREATE_BODIES: ReadonlyArray<readonly [string, unknown, string]> = [
  ['corpo não-objeto', 'texto', 'body'],
  ['sem userId', without(BASE_CREATE_BODY, 'userId'), 'userId'],
  ['userId 0', { ...BASE_CREATE_BODY, userId: 0 }, 'userId'],
  ['userId negativo', { ...BASE_CREATE_BODY, userId: -1 }, 'userId'],
  ['userId string "2"', { ...BASE_CREATE_BODY, userId: '2' }, 'userId'],
  ['userId decimal', { ...BASE_CREATE_BODY, userId: 1.5 }, 'userId'],
  ['userId acima de INT UNSIGNED', { ...BASE_CREATE_BODY, userId: 4_294_967_296 }, 'userId'],
  ['userId null', { ...BASE_CREATE_BODY, userId: null }, 'userId'],
  ['sem cycle', without(BASE_CREATE_BODY, 'cycle'), 'cycle'],
  ['cycle com semestre 3', { ...BASE_CREATE_BODY, cycle: '2026-S3' }, 'cycle'],
  ['cycle trimestral (Q-04)', { ...BASE_CREATE_BODY, cycle: '2026-Q4' }, 'cycle'],
  ['cycle com "s" minúsculo', { ...BASE_CREATE_BODY, cycle: '2026-s1' }, 'cycle'],
  ['cycle com ano de 2 dígitos', { ...BASE_CREATE_BODY, cycle: '26-S1' }, 'cycle'],
  ['cycle com ano antes de 2000', { ...BASE_CREATE_BODY, cycle: '1999-S1' }, 'cycle'],
  ['cycle com ano depois de 2099', { ...BASE_CREATE_BODY, cycle: '2100-S1' }, 'cycle'],
  ['cycle com espaço à esquerda', { ...BASE_CREATE_BODY, cycle: ' 2026-S1' }, 'cycle'],
  ['cycle com espaço à direita', { ...BASE_CREATE_BODY, cycle: '2026-S1 ' }, 'cycle'],
  ['cycle só com o ano', { ...BASE_CREATE_BODY, cycle: '2026' }, 'cycle'],
  ['cycle numérico', { ...BASE_CREATE_BODY, cycle: 20262 }, 'cycle'],
  ['cycle null', { ...BASE_CREATE_BODY, cycle: null }, 'cycle'],
];

/** EVAL-06: mass assignment no POST /evaluations (campo proibido + corpo válido). */
export const FORBIDDEN_CREATE_FIELDS: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ['managerId', { ...BASE_CREATE_BODY, managerId: 1 }],
  ['status', { ...BASE_CREATE_BODY, status: 'CONCLUIDA' }],
  ['selfScore', { ...BASE_CREATE_BODY, selfScore: 5 }],
  ['managerScore', { ...BASE_CREATE_BODY, managerScore: 5 }],
  ['selfSubmittedAt', { ...BASE_CREATE_BODY, selfSubmittedAt: '2026-11-24T12:00:00.000Z' }],
  ['id', { ...BASE_CREATE_BODY, id: 1 }],
];

/**
 * EVAL-14: query strings inválidas no GET /evaluations.
 * [descrição, query string (integração), objeto equivalente ao req.query (unitário), campo]
 */
export const INVALID_LIST_QUERIES: ReadonlyArray<readonly [string, string, Record<string, unknown>, string]> = [
  ['userId não numérico', '?userId=abc', { userId: 'abc' }, 'userId'],
  ['userId 0', '?userId=0', { userId: '0' }, 'userId'],
  ['userId com zero à esquerda', '?userId=01', { userId: '01' }, 'userId'],
  ['userId em notação científica', '?userId=1e3', { userId: '1e3' }, 'userId'],
  ['userId acima de INT UNSIGNED', '?userId=4294967296', { userId: '4294967296' }, 'userId'],
  ['userId vazio', '?userId=', { userId: '' }, 'userId'],
  ['userId repetido', '?userId=1&userId=2', { userId: ['1', '2'] }, 'userId'],
  ['cycle trimestral', '?cycle=2026-Q4', { cycle: '2026-Q4' }, 'cycle'],
  ['cycle vazio', '?cycle=', { cycle: '' }, 'cycle'],
  ['cycle repetido', '?cycle=2026-S1&cycle=2026-S2', { cycle: ['2026-S1', '2026-S2'] }, 'cycle'],
  ['parâmetro desconhecido', '?status=ABERTA', { status: 'ABERTA' }, 'status'],
];

/** EVAL-37: corpos inválidos no PATCH /evaluations/:id. */
export const INVALID_UPDATE_BODIES: ReadonlyArray<readonly [string, unknown, string]> = [
  ['corpo vazio {}', {}, 'body'],
  ['corpo não-objeto', 'texto', 'body'],
  ['selfScore 0', { selfScore: 0 }, 'selfScore'],
  ['selfScore 6', { selfScore: 6 }, 'selfScore'],
  ['selfScore decimal', { selfScore: 3.5 }, 'selfScore'],
  ['selfScore string', { selfScore: '3' }, 'selfScore'],
  ['managerScore 0', { managerScore: 0 }, 'managerScore'],
  ['managerScore 6', { managerScore: 6 }, 'managerScore'],
  ['managerScore string', { managerScore: '4' }, 'managerScore'],
  ['selfComments vazio ""', { selfComments: '' }, 'selfComments'],
  ['selfComments só com espaços', { selfComments: '   ' }, 'selfComments'],
  ['selfComments com 2001 caracteres', { selfComments: 'a'.repeat(2001) }, 'selfComments'],
  ['managerFeedback vazio ""', { managerFeedback: '' }, 'managerFeedback'],
  ['managerFeedback só com espaços', { managerFeedback: '   ' }, 'managerFeedback'],
  ['managerFeedback com 2001 caracteres', { managerFeedback: 'a'.repeat(2001) }, 'managerFeedback'],
  ['submit false', { submit: false }, 'submit'],
  ['submit string "true"', { submit: 'true' }, 'submit'],
  ['submit 1', { submit: 1 }, 'submit'],
  ['submit null', { submit: null }, 'submit'],
];

/** EVAL-37: mass assignment no PATCH /evaluations/:id (campo proibido + campo válido). */
export const FORBIDDEN_UPDATE_FIELDS: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ['userId', { selfComments: 'Texto', userId: 1 }],
  ['managerId', { selfComments: 'Texto', managerId: 1 }],
  ['cycle', { selfComments: 'Texto', cycle: '2026-S1' }],
  ['status', { selfComments: 'Texto', status: 'CONCLUIDA' }],
  ['selfSubmittedAt', { selfComments: 'Texto', selfSubmittedAt: '2026-11-24T12:00:00.000Z' }],
  ['managerSubmittedAt', { selfComments: 'Texto', managerSubmittedAt: '2026-11-24T12:00:00.000Z' }],
  ['id', { selfComments: 'Texto', id: 1 }],
];
