import { createContext, useContext } from 'react';

/**
 * Superfície onde um componente está desenhado. Componentes genéricos (Button, Field, estados…)
 * leem este contexto para manter contraste no hero roxo e no card escuro do dashboard,
 * sem que cada tela precise repassar uma prop de tema.
 */
export type Surface = 'light' | 'dark';

export const SurfaceContext = createContext<Surface>('light');

export const useSurface = (): Surface => useContext(SurfaceContext);
