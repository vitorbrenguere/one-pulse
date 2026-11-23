/**
 * Casos de entrada compartilhados entre os testes unitários (schemas) e de integração (HTTP),
 * para que as duas camadas validem exatamente as mesmas regras da spec 01-auth §3 / §5.
 */

export const VALID_REGISTER = { name: 'Ana Souza', email: 'ana@onepulse.dev', password: 'segura123' } as const;
export const VALID_LOGIN = { email: 'ana@onepulse.dev', password: 'segura123' } as const;

type Payload = Record<string, unknown>;

function without<T extends Payload>(base: T, key: keyof T): Payload {
  const copy: Payload = { ...base };
  delete copy[key as string];
  return copy;
}

/** [descrição, payload, campo que deve aparecer em details] */
export const INVALID_REGISTER_FIELD_CASES: ReadonlyArray<readonly [string, Payload, string]> = [
  ['name ausente', without(VALID_REGISTER, 'name'), 'name'],
  ['name vazio', { ...VALID_REGISTER, name: '' }, 'name'],
  ['name com 1 caractere após trim', { ...VALID_REGISTER, name: ' a ' }, 'name'],
  ['name com 121 caracteres', { ...VALID_REGISTER, name: 'a'.repeat(121) }, 'name'],
  ['email ausente', without(VALID_REGISTER, 'email'), 'email'],
  ['email sem @', { ...VALID_REGISTER, email: 'ana' }, 'email'],
  ['email sem domínio', { ...VALID_REGISTER, email: 'ana@' }, 'email'],
  ['email com 256 caracteres', { ...VALID_REGISTER, email: `${'a'.repeat(243)}@onepulse.dev` }, 'email'],
  ['password ausente', without(VALID_REGISTER, 'password'), 'password'],
  ['password com 7 caracteres', { ...VALID_REGISTER, password: 'abc1234' }, 'password'],
  ['password sem número', { ...VALID_REGISTER, password: 'abcdefgh' }, 'password'],
  ['password sem letra', { ...VALID_REGISTER, password: '12345678' }, 'password'],
  ['password com 73 caracteres', { ...VALID_REGISTER, password: `a1${'x'.repeat(71)}` }, 'password'],
];

/** Corpos que não são um objeto válido. Strings são enviadas cruas como JSON. */
export const INVALID_REGISTER_BODY_CASES: ReadonlyArray<readonly [string, unknown]> = [
  ['objeto vazio {}', {}],
  ['array []', []],
  ['string JSON "texto"', 'texto'],
];

/** Tentativas de mass assignment (AUTH-06). */
export const MASS_ASSIGNMENT_CASES: ReadonlyArray<readonly [string, Payload]> = [
  ['role: GESTOR', { ...VALID_REGISTER, role: 'GESTOR' }],
  ['managerId', { ...VALID_REGISTER, managerId: 1 }],
  ['isActive', { ...VALID_REGISTER, isActive: false }],
  ['passwordHash', { ...VALID_REGISTER, passwordHash: '$2b$04$abc' }],
];

/** AUTH-14 */
export const INVALID_LOGIN_CASES: ReadonlyArray<readonly [string, Payload]> = [
  ['email ausente', without(VALID_LOGIN, 'email')],
  ['password ausente', without(VALID_LOGIN, 'password')],
  ['email mal formado', { ...VALID_LOGIN, email: 'ana@' }],
  ['password vazia', { ...VALID_LOGIN, password: '' }],
  ['campo extra', { ...VALID_LOGIN, role: 'GESTOR' }],
];
