import { Activity, ClipboardCheck, Target, Users } from 'lucide-react';
import type { ReactNode } from 'react';

const HIGHLIGHTS = [
  { icon: Target, text: 'Planos de desenvolvimento com metas e progresso visível.' },
  { icon: ClipboardCheck, text: 'Ciclos semestrais de autoavaliação e avaliação do gestor.' },
  { icon: Users, text: 'Acompanhamento próximo de cada pessoa da equipe.' },
] as const;

/** Login e cadastro: fundo roxo profundo, painel de marca (desktop) e card branco do formulário. */
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-ink-900 px-4 py-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-32 size-[32rem] rounded-full bg-purple-600/30 blur-3xl" />
        <div className="absolute -right-40 -bottom-48 size-[30rem] rounded-full bg-violet-500/20 blur-3xl" />
      </div>

      <div className="grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div className="hidden flex-col gap-10 text-white lg:flex">
          <p className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
            <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-white text-ink-800">
              <Activity className="size-6" />
            </span>
            OnePulse
          </p>
          <p className="text-5xl leading-tight font-semibold tracking-tight">
            Desenvolvimento contínuo, conversas que importam.
          </p>
          <ul className="flex flex-col gap-4">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-4 text-purple-100">
                <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="mx-auto w-full max-w-md">
          <p className="mb-8 flex items-center justify-center gap-2 text-xl font-semibold tracking-tight text-white lg:hidden">
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-white text-ink-800">
              <Activity className="size-5" />
            </span>
            OnePulse
          </p>
          <div className="rounded-3xl bg-white p-8 shadow-2xl shadow-purple-950/40 sm:p-10">
            <h1 className="mb-8 text-3xl font-semibold tracking-tight text-zinc-900">{title}</h1>
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
