export const USER_ROLES = ['COLABORADOR', 'GESTOR'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Representação interna (já mapeada de snake_case). NUNCA sai na API. */
export interface UserRecord {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  managerId: number | null;
  jobTitle: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Representação pública (spec 01-auth §2.3). */
export interface UserDTO {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  managerId: number | null;
  jobTitle: string | null;
  /** ISO 8601 em UTC */
  createdAt: string;
}

export interface NewUser {
  name: string;
  email: string;
  passwordHash: string;
}

/** Campos editáveis pelo próprio usuário (spec 02 §3.2). Ausente = não alterar. */
export interface ProfileChanges {
  name?: string | undefined;
  jobTitle?: string | null | undefined;
}

/** Porta de persistência de usuários (implementada em users.repository.ts). */
export interface UsersRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: number): Promise<UserRecord | null>;
  /** Lança DuplicateEmailError se o e-mail já existir. */
  create(data: NewUser): Promise<UserRecord>;
  /** Liderados DIRETOS e ATIVOS, ordenados por name ASC, id ASC (spec 02 §4.1). */
  findTeamByManagerId(managerId: number): Promise<UserRecord[]>;
  /** Atualiza só os campos presentes e devolve o registro relido (null se o id não existir). */
  updateProfile(id: number, changes: ProfileChanges): Promise<UserRecord | null>;
}
