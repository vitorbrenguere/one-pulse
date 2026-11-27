import { Activity, LogOut, Menu as MenuIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useLogout } from '../../features/auth/hooks/useAuthMutations';
import { useCurrentUser } from '../../features/auth/useAuth';
import { cn } from '../../lib/cn';
import { roleLabel } from '../../lib/labels';
import { Button, FOCUS_RING } from '../ui/Button';
import { SurfaceContext } from '../ui/surface';
import { HeroSlotContext } from './hero-slot';

const LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/goals', label: 'Metas' },
  { to: '/evaluations', label: 'Avaliações' },
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/**
 * Layout das rotas protegidas (spec 05 §5): hero roxo com o `<header>` (uma única `<nav>`; no mobile,
 * o botão Menu a mostra/esconde) e o slot onde o `PageHeader` de cada página é desenhado.
 */
export function AppShell() {
  const user = useCurrentUser();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroSlot, setHeroSlot] = useState<HTMLDivElement | null>(null);
  const navId = useId();

  return (
    <div className="isolate min-h-screen overflow-x-clip bg-canvas">
      <SurfaceContext value="dark">
        <div className="relative isolate overflow-hidden rounded-b-[2.5rem] bg-linear-to-br from-ink-800 via-ink-700 to-ink-900 pb-14 text-white sm:pb-16">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-32 right-[-10%] size-[28rem] rounded-full bg-purple-600/25 blur-3xl" />
            <div className="absolute -bottom-40 left-[-5%] size-[24rem] rounded-full bg-violet-500/15 blur-3xl" />
          </div>

          <header className="relative mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-4 px-4 pt-6 sm:px-6">
            <span className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-white text-ink-800">
                <Activity className="size-5" />
              </span>
              OnePulse
            </span>

            <Button
              variant="secondary"
              size="sm"
              className="ml-auto size-10 px-0 md:hidden"
              aria-expanded={menuOpen}
              aria-controls={navId}
              aria-label="Menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MenuIcon aria-hidden="true" className="size-5" />
            </Button>

            <nav
              id={navId}
              aria-label="Principal"
              className={cn('w-full md:mx-auto md:flex md:w-auto', menuOpen ? 'flex' : 'hidden')}
            >
              <ul className="flex w-full flex-col gap-1 rounded-3xl bg-white/5 p-1.5 ring-1 ring-white/10 backdrop-blur md:flex-row md:rounded-full">
                {LINKS.map(({ to, label }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'block rounded-full px-5 py-2 text-sm transition-colors',
                          FOCUS_RING,
                          'focus-visible:ring-offset-ink-800',
                          isActive ? 'bg-white font-semibold text-ink-800 shadow-sm' : 'font-medium text-purple-200 hover:bg-white/10 hover:text-white',
                        )
                      }
                    >
                      {label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="flex w-full items-center gap-3 rounded-full bg-white/5 py-1.5 pr-1.5 pl-1.5 ring-1 ring-white/10 md:w-auto">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-purple-400 to-violet-600 text-xs font-semibold"
              >
                {initials(user.name)}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-semibold text-white">{user.name}</span>
                <span className="text-xs text-purple-200">{roleLabel(user.role)}</span>
              </span>
              <Button
                variant="secondary"
                size="sm"
                className="ml-auto md:ml-2"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                <LogOut aria-hidden="true" className="size-4" />
                Sair
              </Button>
            </div>
          </header>

          <div ref={setHeroSlot} className="relative mx-auto max-w-6xl px-4 pt-12 sm:px-6 sm:pt-16" />
        </div>
      </SurfaceContext>

      <HeroSlotContext value={heroSlot}>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <Outlet />
        </main>
      </HeroSlotContext>
    </div>
  );
}
