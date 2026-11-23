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
