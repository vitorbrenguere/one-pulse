/**
 * Casos compartilhados entre os testes unitários (schemas) e de integração (HTTP) da spec 03.
 * Formato das tabelas: [descrição, entrada, campo esperado em details[].field].
 */

/** Prazo bem no futuro: os testes não "vencem" com o passar do tempo. */
export const FAR_FUTURE = '2099-12-31';

export const VALID_CREATE_BODY = {
  title: 'Aprender testes de integração',
  category: 'TECNICA',
  targetDate: FAR_FUTURE,
} as const;

function without<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

/** GOAL-19 / GOAL-44: :id inválidos na URL. */
export const INVALID_GOAL_IDS: readonly string[] = ['abc', '0', '-1', '1.5', '1e3', '01', '4294967296'];

export const VALID_GOAL_IDS: ReadonlyArray<readonly [string, number]> = [
  ['1', 1],
  ['42', 42],
  ['4294967295', 4_294_967_295],
];

/** GOAL-05: corpos inválidos no POST /pd-goals. */
export const INVALID_CREATE_BODIES: ReadonlyArray<readonly [string, unknown, string]> = [
  ['corpo não-objeto', 'texto', 'body'],
  ['sem title', without(VALID_CREATE_BODY, 'title'), 'title'],
  ['title com 2 caracteres', { ...VALID_CREATE_BODY, title: 'ab' }, 'title'],
  ['title com 151 caracteres', { ...VALID_CREATE_BODY, title: 'a'.repeat(151) }, 'title'],
  ['title só com espaços', { ...VALID_CREATE_BODY, title: '   ' }, 'title'],
  ['title não-string', { ...VALID_CREATE_BODY, title: 123 }, 'title'],
  ['sem category', without(VALID_CREATE_BODY, 'category'), 'category'],
  ['category fora do enum', { ...VALID_CREATE_BODY, category: 'OUTRA' }, 'category'],
  ['sem targetDate', without(VALID_CREATE_BODY, 'targetDate'), 'targetDate'],
  ['targetDate null', { ...VALID_CREATE_BODY, targetDate: null }, 'targetDate'],
  ['targetDate 30 de fevereiro', { ...VALID_CREATE_BODY, targetDate: '2026-02-30' }, 'targetDate'],
  ['targetDate 29/02 em ano não bissexto', { ...VALID_CREATE_BODY, targetDate: '2027-02-29' }, 'targetDate'],
  ['targetDate mês 13', { ...VALID_CREATE_BODY, targetDate: '2099-13-01' }, 'targetDate'],
  ['targetDate no formato DD/MM/AAAA', { ...VALID_CREATE_BODY, targetDate: '24/11/2026' }, 'targetDate'],
  ['targetDate com horário', { ...VALID_CREATE_BODY, targetDate: '2099-11-24T00:00:00Z' }, 'targetDate'],
  ['description vazia ""', { ...VALID_CREATE_BODY, description: '' }, 'description'],
  ['description só com espaços', { ...VALID_CREATE_BODY, description: '   ' }, 'description'],
  ['description com 2001 caracteres', { ...VALID_CREATE_BODY, description: 'a'.repeat(2001) }, 'description'],
  ['userId 0', { ...VALID_CREATE_BODY, userId: 0 }, 'userId'],
  ['userId negativo', { ...VALID_CREATE_BODY, userId: -1 }, 'userId'],
  ['userId string "2"', { ...VALID_CREATE_BODY, userId: '2' }, 'userId'],
  ['userId decimal', { ...VALID_CREATE_BODY, userId: 1.5 }, 'userId'],
  ['userId acima de INT UNSIGNED', { ...VALID_CREATE_BODY, userId: 4_294_967_296 }, 'userId'],
];

/** GOAL-07: mass assignment no POST /pd-goals (campo proibido + corpo válido). */
export const FORBIDDEN_CREATE_FIELDS: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ['status', { ...VALID_CREATE_BODY, status: 'EM_ANDAMENTO' }],
  ['progress', { ...VALID_CREATE_BODY, progress: 50 }],
  ['createdBy', { ...VALID_CREATE_BODY, createdBy: 1 }],
  ['completedAt', { ...VALID_CREATE_BODY, completedAt: '2026-11-24T12:00:00.000Z' }],
  ['managerFeedback', { ...VALID_CREATE_BODY, managerFeedback: 'Parecer' }],
  ['id', { ...VALID_CREATE_BODY, id: 1 }],
];

/**
 * GOAL-14: query strings inválidas no GET /pd-goals.
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
  ['parâmetro desconhecido', '?status=EM_ANDAMENTO', { status: 'EM_ANDAMENTO' }, 'status'],
];

/** GOAL-37: corpos inválidos no PATCH /pd-goals/:id. */
export const INVALID_UPDATE_BODIES: ReadonlyArray<readonly [string, unknown, string]> = [
  ['corpo vazio {}', {}, 'body'],
  ['corpo não-objeto', 'texto', 'body'],
  ['title com 2 caracteres', { title: 'ab' }, 'title'],
  ['title null', { title: null }, 'title'],
  ['description vazia ""', { description: '' }, 'description'],
  ['category fora do enum', { category: 'OUTRA' }, 'category'],
  ['targetDate null', { targetDate: null }, 'targetDate'],
  ['targetDate inexistente', { targetDate: '2026-02-30' }, 'targetDate'],
  ['progress -1', { progress: -1 }, 'progress'],
  ['progress 101', { progress: 101 }, 'progress'],
  ['progress decimal', { progress: 50.5 }, 'progress'],
  ['progress string', { progress: '50' }, 'progress'],
  ['progress null', { progress: null }, 'progress'],
  ['status fora do enum', { status: 'PAUSADA' }, 'status'],
  ['status null', { status: null }, 'status'],
  ['managerFeedback vazio ""', { managerFeedback: '' }, 'managerFeedback'],
  ['managerFeedback só com espaços', { managerFeedback: '   ' }, 'managerFeedback'],
  ['managerFeedback com 2001 caracteres', { managerFeedback: 'a'.repeat(2001) }, 'managerFeedback'],
  // Combinações contraditórias status × progress (spec 03 §2.5)
  ['CONCLUIDA com progress 50', { status: 'CONCLUIDA', progress: 50 }, 'progress'],
  ['NAO_INICIADA com progress 10', { status: 'NAO_INICIADA', progress: 10 }, 'progress'],
  ['EM_ANDAMENTO com progress 100', { status: 'EM_ANDAMENTO', progress: 100 }, 'progress'],
  ['CANCELADA com progress 10', { status: 'CANCELADA', progress: 10 }, 'progress'],
  ['CANCELADA com progress 0', { status: 'CANCELADA', progress: 0 }, 'progress'],
];

/** GOAL-37: mass assignment no PATCH /pd-goals/:id (campo proibido + campo válido). */
export const FORBIDDEN_UPDATE_FIELDS: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ['userId', { title: 'Novo título', userId: 1 }],
  ['createdBy', { title: 'Novo título', createdBy: 1 }],
  ['completedAt', { title: 'Novo título', completedAt: '2026-11-24T12:00:00.000Z' }],
  ['managerFeedbackAt', { title: 'Novo título', managerFeedbackAt: '2026-11-24T12:00:00.000Z' }],
  ['id', { title: 'Novo título', id: 1 }],
  ['createdAt', { title: 'Novo título', createdAt: '2026-11-24T12:00:00.000Z' }],
];
