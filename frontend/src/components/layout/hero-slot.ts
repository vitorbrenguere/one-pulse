import { createContext } from 'react';

/**
 * Elemento do hero roxo do AppShell onde o `PageHeader` da página é renderizado (via portal).
 * - `undefined`: fora do AppShell (o PageHeader renderiza no lugar, em superfície clara);
 * - `null`: dentro do AppShell, mas o slot ainda não foi montado.
 */
export const HeroSlotContext = createContext<HTMLElement | null | undefined>(undefined);
