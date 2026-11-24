import type { Response } from 'supertest';
import { expect } from 'vitest';
import type { UserDTO } from '../../src/modules/users/user.types.js';

const ISO_8601_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * Garante o formato EXATO do UserDTO (spec §2.3): `toEqual` falha se houver
 * chave a mais (ex.: passwordHash) ou a menos.
 */
export function expectUserDTO(actual: unknown, expected: Partial<UserDTO> = {}): void {
  expect(actual).toEqual({
    id: expect.any(Number),
    name: expect.any(String),
    email: expect.any(String),
    role: expect.stringMatching(/^(COLABORADOR|GESTOR)$/),
    managerId: null,
    jobTitle: null,
    createdAt: expect.stringMatching(ISO_8601_UTC),
    ...expected,
  });
}

/** Envelope de erro padrão (CLAUDE.md §5 / spec §2.4). */
export function expectError(res: Response, status: number, code: string): void {
  expect(res.status).toBe(status);
  expect(res.body).toMatchObject({ error: { code, message: expect.any(String) } });
}

export function getSetCookies(res: Response): string[] {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  if (header === undefined) return [];
  return Array.isArray(header) ? header : [header];
}

export function findSetCookie(res: Response, name: string): string | undefined {
  return getSetCookies(res).find((cookie) => cookie.startsWith(`${name}=`));
}

/** Extrai o valor de um cookie a partir do header Set-Cookie. */
export function cookieValue(setCookie: string): string {
  const [pair = ''] = setCookie.split(';');
  return decodeURIComponent(pair.slice(pair.indexOf('=') + 1));
}

const SENSITIVE_KEYS = ['password', 'passwordHash', 'password_hash', 'isActive', 'is_active'];

/** Nenhuma chave sensível em nenhum nível, nem hash bcrypt em valores (AUTH-26 / USER-32). */
export function expectNoSensitiveData(body: unknown, label: string): void {
  const keys = collectKeysDeep(body);
  for (const key of SENSITIVE_KEYS) {
    expect(keys.has(key), `chave proibida "${key}" em ${label}`).toBe(false);
  }
  expect(JSON.stringify(body), `hash bcrypt exposto em ${label}`).not.toMatch(/\$2[aby]\$/);
}

/** Coleta todas as chaves de um JSON, em qualquer nível de profundidade (AUTH-26). */
export function collectKeysDeep(value: unknown, keys: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => collectKeysDeep(item, keys));
  } else if (value !== null && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      keys.add(key);
      collectKeysDeep(nested, keys);
    }
  }
  return keys;
}
