import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../../components/ui/Badge';
import { SectionCard } from '../../../components/ui/Card';
import { EmptyState, ErrorBanner, LoadingState } from '../../../components/ui/States';
import { useCurrentUser } from '../../auth/useAuth';
import { useEvaluations } from '../../evaluations/hooks/useEvaluations';
import { useTeam } from '../../team/hooks/useTeam';
import { pendingUserIds } from './pending';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''}`.toUpperCase();
}

/** Equipe do GESTOR com badge de avaliação pendente (spec 05 §6.2, D-07: uma chamada só de avaliações). */
export function TeamSection() {
  const user = useCurrentUser();
  const team = useTeam();
  const evaluations = useEvaluations();
  const pending = pendingUserIds(evaluations.data, user.id);

  return (
    <SectionCard title="Minha equipe" tone="dark">
      {team.isPending ? (
        <LoadingState />
      ) : team.isError ? (
        <ErrorBanner error={team.error} onRetry={() => void team.refetch()} />
      ) : team.data.length === 0 ? (
        <EmptyState title="Você ainda não tem liderados diretos." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {team.data.map((member) => (
            <li
              key={member.id}
              className="group relative flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/8 p-5 transition-colors hover:bg-white/12 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-purple-400"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-purple-400 to-violet-600 text-sm font-semibold"
                >
                  {initials(member.name)}
                </span>
                <span
                  aria-hidden="true"
                  className="flex size-9 items-center justify-center rounded-full bg-purple-600 text-white transition-colors group-hover:bg-purple-500"
                >
                  <ArrowUpRight className="size-4" />
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {/* O `after:` estende a área clicável do link para o card todo, sem um segundo link. */}
                <Link
                  to={`/team/${member.id}`}
                  className="font-semibold text-white outline-none after:absolute after:inset-0 after:rounded-2xl"
                >
                  {member.name}
                </Link>
                {member.jobTitle && <span className="text-sm text-purple-200">{member.jobTitle}</span>}
                <span className="truncate text-sm text-purple-300">{member.email}</span>
              </div>
              {pending.has(member.id) && (
                <div>
                  <Badge tone="amber">Avaliação pendente</Badge>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
