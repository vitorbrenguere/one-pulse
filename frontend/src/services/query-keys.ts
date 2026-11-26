/** Fábrica de query keys (spec 05 §3.4). Filtros ausentes viram `{}` para a key ser estável. */
export const queryKeys = {
  me: ['auth', 'me'] as const,
  team: ['users', 'team'] as const,
  user: (id: number) => ['users', id] as const,
  goalsRoot: ['goals'] as const,
  goals: (userId?: number) => ['goals', userId === undefined ? {} : { userId }] as const,
  evaluationsRoot: ['evaluations'] as const,
  evaluations: (userId?: number) => ['evaluations', userId === undefined ? {} : { userId }] as const,
};
