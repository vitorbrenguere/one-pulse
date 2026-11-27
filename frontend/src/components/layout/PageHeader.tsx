import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';
import { SurfaceContext, type Surface } from '../ui/surface';
import { HeroSlotContext } from './hero-slot';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Bloco à direita do título (ex.: métricas do dashboard). */
  aside?: ReactNode;
  /** Linha abaixo do título (ex.: filtros). */
  children?: ReactNode;
}

function HeaderContent({ title, description, actions, aside, children, surface }: PageHeaderProps & { surface: Surface }) {
  const dark = surface === 'dark';
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="max-w-2xl">
          <h1
            className={cn(
              'font-semibold tracking-tight',
              dark ? 'text-4xl text-white sm:text-5xl' : 'text-3xl text-zinc-900',
            )}
          >
            {title}
          </h1>
          {description && (
            <div className={cn('mt-3 text-base', dark ? 'text-purple-200' : 'text-zinc-600')}>{description}</div>
          )}
        </div>
        {aside}
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

/**
 * Título da página. Dentro do AppShell, é renderizado no hero roxo (portal para o slot);
 * fora dele, no próprio lugar. A ordem no DOM (banner → hero → main) mantém a leitura linear.
 */
export function PageHeader(props: PageHeaderProps) {
  const slot = useContext(HeroSlotContext);
  if (slot === undefined) return <HeaderContent {...props} surface="light" />;
  if (slot === null) return null;
  return createPortal(
    <SurfaceContext value="dark">
      <HeaderContent {...props} surface="dark" />
    </SurfaceContext>,
    slot,
  );
}
