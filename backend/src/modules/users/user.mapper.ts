import type { UserDTO, UserRecord } from './user.types.js';

/**
 * Único caminho de um usuário para fora da API. A lista de campos é explícita, e não
 * um spread com campos removidos: assim, um campo novo e sensível nunca vaza por acidente.
 */
export function toUserDTO(user: UserRecord): UserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    managerId: user.managerId,
    jobTitle: user.jobTitle,
    createdAt: user.createdAt.toISOString(),
  };
}
