import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../../components/ui/Badge';
import { FOCUS_RING } from '../../../components/ui/Button';
import { SectionCard } from '../../../components/ui/Card';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { EmptyState, ErrorBanner, LoadingState } from '../../../components/ui/States';
import type { Surface } from '../../../components/ui/surface';
import { cn } from '../../../lib/cn';
import { formatDate, isOverdue, todayUtc } from '../../../lib/dates';
import { GOAL_STATUSES, goalStatusLabel } from '../../../lib/labels';
import type { GoalDTO } from '../../../types/api';
import { useGoals } from '../../pdi/hooks/useGoals';

const MAX_ACTIVE = 5;
const isActive = (goal: GoalDTO) => goal.status === 'NAO_INICIADA' || goal.status === 'EM_ANDAMENTO';

const pillLink = (tone: Surface) =>
  cn(
    'inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors',
    FOCUS_RING,
    tone === 'dark'
      ? 'bg-purple-600 text-white hover:bg-purple-500 focus-visible:ring-offset-ink-950'
      : 'border border-purple-200 text-ink-800 hover:bg-purple-50',
  );

/** Resumo das próprias metas (spec 05 §6.2). `dark` quando é o destaque do dashboard. */
export function GoalsSummary({ tone = 'light' }: { tone?: Surface }) {
  const goals = useGoals();

  return (
    <SectionCard
      title="Minhas metas"
      tone={tone}
      actions={
        <Link to="/goals" className={pillLink(tone)}>
          Ver todas
          <ArrowRight aria-hidden="true" className="size-4" />
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
            <Link to="/goals?new=1" className={pillLink(tone)}>
              Criar primeira meta
            </Link>
          }
        />
      ) : (
        <GoalsOverview goals={goals.data} tone={tone} />
      )}
    </SectionCard>
  );
}

function GoalsOverview({ goals, tone }: { goals: GoalDTO[]; tone: Surface }) {
  const today = todayUtc();
  const active = goals.filter(isActive).slice(0, MAX_ACTIVE);
  const dark = tone === 'dark';

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {GOAL_STATUSES.map((status) => (
          <div
            key={status}
            className={cn('rounded-2xl p-4', dark ? 'border border-white/10 bg-white/8' : 'bg-canvas')}
          >
            <dt className={cn('text-xs', dark ? 'text-purple-200' : 'text-zinc-600')}>{goalStatusLabel(status)}</dt>
            <dd className={cn('mt-1 text-3xl font-semibold tracking-tight tabular-nums', dark ? 'text-white' : 'text-zinc-900')}>
              {goals.filter((g) => g.status === status).length}
            </dd>
          </div>
        ))}
      </dl>

      {active.length === 0 ? (
        <p className={cn('text-sm', dark ? 'text-purple-200' : 'text-zinc-600')}>Nenhuma meta ativa no momento.</p>
      ) : (
        <ul aria-label="Metas ativas" className={cn('flex flex-col divide-y', dark ? 'divide-white/10' : 'divide-purple-100/70')}>
          {active.map((goal) => (
            <li key={goal.id} className="flex flex-col gap-2.5 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={cn('text-sm font-medium', dark ? 'text-white' : 'text-zinc-900')}>{goal.title}</span>
                <span className={cn('flex items-center gap-2 text-xs', dark ? 'text-purple-200' : 'text-zinc-600')}>
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
