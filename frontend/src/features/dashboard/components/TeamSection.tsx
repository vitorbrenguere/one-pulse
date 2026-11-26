import { Link } from 'react-router-dom';
import { Badge } from '../../../components/ui/Badge';
import { FOCUS_RING } from '../../../components/ui/Button';
import { SectionCard } from '../../../components/ui/Card';
import { EmptyState, ErrorBanner, LoadingState } from '../../../components/ui/States';
import { cn } from '../../../lib/cn';
import type { EvaluationDTO } from '../../../types/api';
import { useCurrentUser } from '../../auth/useAuth';
import { useEvaluations } from '../../evaluations/hooks/useEvaluations';
import { useTeam } from '../../team/hooks/useTeam';

/** Liderados com avaliação ABERTA em que a parte do gestor ainda não foi enviada. */
function pendingUserIds(evaluations: EvaluationDTO[] | undefined, managerId: number): Set<number> {
  return new Set(
    (evaluations ?? [])
      .filter((e) => e.status === 'ABERTA' && e.managerId === managerId && !e.managerSubmittedAt)
      .map((e) => e.userId),
  );
}

/** Equipe do GESTOR com badge de avaliação pendente (spec 05 §6.2, D-07: uma chamada só de avaliações). */
export function TeamSection() {
  const user = useCurrentUser();
  const team = useTeam();
  const evaluations = useEvaluations();
  const pending = pendingUserIds(evaluations.data, user.id);

  return (
    <SectionCard title="Minha equipe">
      {team.isPending ? (
        <LoadingState />
      ) : team.isError ? (
        <ErrorBanner error={team.error} onRetry={() => void team.refetch()} />
      ) : team.data.length === 0 ? (
        <EmptyState title="Você ainda não tem liderados diretos." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {team.data.map((member) => (
            <li key={member.id} className="flex flex-col gap-1 rounded-md border border-zinc-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  to={`/team/${member.id}`}
                  className={cn('rounded font-medium text-zinc-900 underline-offset-2 hover:underline', FOCUS_RING)}
                >
                  {member.name}
                </Link>
                {pending.has(member.id) && <Badge tone="amber">Avaliação pendente</Badge>}
              </div>
              {member.jobTitle && <span className="text-sm text-zinc-600">{member.jobTitle}</span>}
              <span className="text-sm text-zinc-600">{member.email}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
