/**
 * Casos compartilhados entre os testes unitários (schemas) e de integração (HTTP) da spec 02.
 */

/** USER-15: IDs de URL inválidos. */
export const INVALID_USER_IDS: readonly string[] = ['abc', '0', '-1', '1.5', '1e3', '01', '4294967296', 'me'];

/** Fronteiras válidas do :id (INT UNSIGNED). */
export const VALID_USER_IDS: ReadonlyArray<readonly [string, number]> = [
  ['1', 1],
  ['42', 42],
  ['4294967295', 4_294_967_295],
];

/** USER-21: tentativas de mass assignment no PATCH /users/me (com um campo válido junto). */
export const FORBIDDEN_PROFILE_FIELDS: ReadonlyArray<readonly [string, Record<string, unknown>]> = [
  ['email', { name: 'Novo Nome', email: 'outro@onepulse.dev' }],
  ['role', { name: 'Novo Nome', role: 'GESTOR' }],
  ['managerId', { name: 'Novo Nome', managerId: 1 }],
  ['isActive', { name: 'Novo Nome', isActive: false }],
  ['password', { name: 'Novo Nome', password: 'novaSenha123' }],
];

/** USER-22: corpos inválidos no PATCH /users/me. */
export const INVALID_PROFILE_BODIES: ReadonlyArray<readonly [string, unknown, string]> = [
  ['corpo vazio {}', {}, 'body'],
  ['name com 1 caractere', { name: 'A' }, 'name'],
  ['name só com espaços', { name: '   ' }, 'name'],
  ['jobTitle vazio ""', { jobTitle: '' }, 'jobTitle'],
  ['jobTitle só com espaços', { jobTitle: '   ' }, 'jobTitle'],
  ['jobTitle com 121 caracteres', { jobTitle: 'a'.repeat(121) }, 'jobTitle'],
  ['jobTitle não-string', { jobTitle: 123 }, 'jobTitle'],
];
