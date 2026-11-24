import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SEED_PASSWORD, runSeed, SEED_USERS, validateSeedUsers, type SeedUser } from './seed.js';

const gestor = (email: string): SeedUser => ({ name: 'Gestor', email, role: 'GESTOR', jobTitle: null, managerEmail: null });
const colaborador = (email: string, managerEmail: string | null): SeedUser => ({
  name: 'Colaborador',
  email,
  role: 'COLABORADOR',
  jobTitle: null,
  managerEmail,
});

describe('validateSeedUsers', () => {
  it('[USER-31] a lista oficial (spec 02 §5.2) com a senha padrão é válida', () => {
    expect(() => validateSeedUsers(SEED_USERS, DEFAULT_SEED_PASSWORD)).not.toThrow();
  });

  it.each([
    [
      'e-mail duplicado (sem diferenciar maiúsculas)',
      [gestor('g@onepulse.dev'), colaborador('dup@onepulse.dev', 'g@onepulse.dev'), colaborador('DUP@onepulse.dev', 'g@onepulse.dev')],
      'SEED-DUP-EMAIL',
      'dup@onepulse.dev',
    ],
    ['gestor de si mesmo', [gestor('g@onepulse.dev'), colaborador('self@onepulse.dev', 'self@onepulse.dev')], 'USR-INV-01', 'self@onepulse.dev'],
    ['gestor inexistente na lista', [colaborador('orfao@onepulse.dev', 'fantasma@onepulse.dev')], 'SEED-UNKNOWN-MANAGER', 'orfao@onepulse.dev'],
    [
      'gestor com papel COLABORADOR',
      [colaborador('chefe@onepulse.dev', null), colaborador('sub@onepulse.dev', 'chefe@onepulse.dev')],
      'USR-INV-02',
      'sub@onepulse.dev',
    ],
  ])('[USER-31] rejeita %s citando a regra e o e-mail', (_description, users, rule, email) => {
    let thrown: unknown;
    try {
      validateSeedUsers(users, DEFAULT_SEED_PASSWORD);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain(rule);
    expect((thrown as Error).message.toLowerCase()).toContain(email.toLowerCase());
  });

  it.each(['curta1', 'semnumero', '12345678'])('[USER-31] rejeita senha fora da política ("%s") com SEED-WEAK-PASSWORD', (password) => {
    expect(() => validateSeedUsers(SEED_USERS, password)).toThrow(/SEED-WEAK-PASSWORD/);
  });
});

describe('runSeed', () => {
  it('[USER-30] recusa NODE_ENV=production ANTES de abrir conexão com o banco', async () => {
    const connect = vi.fn();

    await expect(
      runSeed({ nodeEnv: 'production', password: DEFAULT_SEED_PASSWORD, bcryptRounds: 4, connect }),
    ).rejects.toThrow(/produ/i);
    expect(connect).not.toHaveBeenCalled();
  });
});
