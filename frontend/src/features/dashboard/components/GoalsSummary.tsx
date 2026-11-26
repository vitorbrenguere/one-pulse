import { Link } from 'react-router-dom';
import { Badge } from '../../../components/ui/Badge';
import { FOCUS_RING } from '../../../components/ui/Button';
import { SectionCard } from '../../../components/ui/Card';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { EmptyState, ErrorBanner, LoadingState } from '../../../components/ui/States';
import { cn } from '../../../lib/cn';
import { formatDate, isOverdue, todayUtc } from '../../../lib/dates';
import { GOAL_STATUSES, goalStatusLabel } from '../../../lib/labels';
import type { GoalDTO } from '../../../types/api';
import { useGoals } from '../../pdi/hooks/useGoals';

const LINK = cn('rounded text-sm font-medium text-zinc-900 underline underline-offset-2', FOCUS_RING);
const MAX_ACTIVE = 5;
const isActive = (goal: GoalDTO) => goal.status === 'NAO_INICIADA' || goal.status === 'EM_ANDAMENTO';

/** Resumo das próprias metas (spec 05 §6.2). */
export function GoalsSummary() {
  const goals = useGoals();

  return (
    <SectionCard
      title="Minhas metas"
      actions={
        <Link to="/goals" className={LINK}>
          Ver todas
        </Link>
      }
    >
      {goals.isPending ? (
        <LoadingState />
      ) : goals.isError ? (
        <ErrorBanner error={goals.error} onRetry={() => void goals.refetch()} />
      ) : goals.data.length === 0 ? (
        <EmptyState
          title="Você ainda não tem metas de PDI."
          action={
            <Link to="/goals?new=1" className={LINK}>
              Criar primeira meta
            </Link>
          }
        />
      ) : (
        <GoalsOverview goals={goals.data} />
      )}
    </SectionCard>
  );
}

function GoalsOverview({ goals }: { goals: GoalDTO[] }) {
  const today = todayUtc();
  const active = goals.filter(isActive).slice(0, MAX_ACTIVE);

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {GOAL_STATUSES.map((status) => (
          <div key={status} className="rounded-md bg-zinc-50 p-3">
            <dt className="text-xs text-zinc-600">{goalStatusLabel(status)}</dt>
            <dd className="text-xl font-semibold text-zinc-900">{goals.filter((g) => g.status === status).length}</dd>
          </div>
        ))}
      </dl>

      {active.length === 0 ? (
        <p className="text-sm text-zinc-600">Nenhuma meta ativa no momento.</p>
      ) : (
        <ul aria-label="Metas ativas" className="flex flex-col gap-3">
          {active.map((goal) => (
            <li key={goal.id} className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-900">{goal.title}</span>
                <span className="flex items-center gap-2 text-xs text-zinc-600">
                  {isOverdue(goal, today) && <Badge tone="red">Atrasada</Badge>}
                  Prazo {formatDate(goal.targetDate)} · {goal.progress}%
                </span>
              </div>
              <ProgressBar value={goal.progress} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
