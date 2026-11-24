/**
 * Seed de desenvolvimento (spec 02 §5): 2 equipes, com 2 gestores e 3 liderados.
 * Uso: npm run seed   (lê backend/.env; recusa rodar com NODE_ENV=production)
 */
import { pathToFileURL } from 'node:url';
import type { Connection } from 'mysql2/promise';
import type { UserRole } from '../src/modules/users/user.types.js';
import { NotImplementedError } from '../src/shared/errors/not-implemented.error.js';

export interface SeedUser {
  name: string;
  email: string;
  role: UserRole;
  jobTitle: string | null;
  /** E-mail do gestor dentro da própria lista (null = sem gestor). */
  managerEmail: string | null;
}

/** Dados oficiais (spec 02 §5.2). A ordem importa: gestores antes dos liderados. */
export const SEED_USERS: readonly SeedUser[] = [
  { name: 'Gabriela Martins', email: 'gabriela@onepulse.dev', role: 'GESTOR', jobTitle: 'Engineering Manager', managerEmail: null },
  { name: 'Carlos Lima', email: 'carlos@onepulse.dev', role: 'COLABORADOR', jobTitle: 'Desenvolvedor Júnior', managerEmail: 'gabriela@onepulse.dev' },
  { name: 'Camila Rocha', email: 'camila@onepulse.dev', role: 'COLABORADOR', jobTitle: 'Desenvolvedora Pleno', managerEmail: 'gabriela@onepulse.dev' },
  { name: 'Gustavo Alves', email: 'gustavo@onepulse.dev', role: 'GESTOR', jobTitle: 'Product Manager', managerEmail: null },
  { name: 'Diego Ferreira', email: 'diego@onepulse.dev', role: 'COLABORADOR', jobTitle: 'Analista de Produto', managerEmail: 'gustavo@onepulse.dev' },
];

export const DEFAULT_SEED_PASSWORD = 'onepulse123';

export interface RunSeedOptions {
  nodeEnv: string;
  password: string;
  bcryptRounds: number;
  connect: () => Promise<Connection>;
  users?: readonly SeedUser[];
}

export interface SeedResult {
  users: Array<{ id: number; email: string; role: UserRole }>;
}

/** Valida a lista antes de qualquer escrita (spec 02 §5.4). Lança erro com o id da regra e o e-mail. */
export function validateSeedUsers(_users: readonly SeedUser[], _password: string): void {
  throw new NotImplementedError('validateSeedUsers');
}

/** Upsert transacional e convergente (spec 02 §5.3). */
export async function runSeed(_options: RunSeedOptions): Promise<SeedResult> {
  throw new NotImplementedError('runSeed');
}

// Execução via CLI (npm run seed)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  throw new NotImplementedError('seed CLI');
}
