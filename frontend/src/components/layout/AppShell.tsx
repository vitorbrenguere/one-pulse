import { LogOut, Menu as MenuIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useLogout } from '../../features/auth/hooks/useAuthMutations';
import { useCurrentUser } from '../../features/auth/useAuth';
import { cn } from '../../lib/cn';
import { roleLabel } from '../../lib/labels';
import { Badge } from '../ui/Badge';
import { Button, FOCUS_RING } from '../ui/Button';

const LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/goals', label: 'Metas' },
  { to: '/evaluations', label: 'Avaliações' },
] as const;

/** Layout das rotas protegidas (spec 05 §5): uma única `<nav>`; no mobile, o botão Menu a mostra/esconde. */
export function AppShell() {
  const user = useCurrentUser();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);
  const navId = useId();

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
          <span className="text-lg font-semibold tracking-tight text-zinc-900">OnePulse</span>

          <Button
            variant="ghost"
            size="sm"
            className="ml-auto md:hidden"
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
            className={cn('w-full md:flex md:w-auto', menuOpen ? 'flex' : 'hidden')}
          >
            <ul className="flex w-full flex-col gap-1 md:flex-row">
              {LINKS.map(({ to, label }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'block rounded-md px-3 py-2 text-sm font-medium',
                        FOCUS_RING,
                        isActive ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100',
                      )
                    }
                  >
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex w-full items-center gap-3 md:ml-auto md:w-auto">
            <span className="text-sm font-medium text-zinc-900">{user.name}</span>
            <Badge>{roleLabel(user.role)}</Badge>
            <Button variant="secondary" size="sm" className="ml-auto md:ml-0" onClick={() => logout.mutate()} disabled={logout.isPending}>
              <LogOut aria-hidden="true" className="size-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
