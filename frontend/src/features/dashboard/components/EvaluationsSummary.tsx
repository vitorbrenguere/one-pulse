import { Link } from 'react-router-dom';
import { Badge } from '../../../components/ui/Badge';
import { FOCUS_RING } from '../../../components/ui/Button';
import { SectionCard } from '../../../components/ui/Card';
import { ErrorBanner, LoadingState } from '../../../components/ui/States';
import { cn } from '../../../lib/cn';
import { formatCycle } from '../../../lib/dates';
import { useCurrentUser } from '../../auth/useAuth';
import { NO_EVALUATIONS_MESSAGE } from '../../evaluations/components/messages';
import { useEvaluations } from '../../evaluations/hooks/useEvaluations';
import { getEvaluationViewState } from '../../evaluations/view-state';

/** Status das próprias avaliações (COLABORADOR, spec 05 §6.2). */
export function EvaluationsSummary() {
  const user = useCurrentUser();
  const evaluations = useEvaluations();

  return (
    <SectionCard
      title="Minhas avaliações"
      actions={
        <Link to="/evaluations" className={cn('rounded text-sm font-medium text-zinc-900 underline underline-offset-2', FOCUS_RING)}>
          Ver avaliações
        </Link>
      }
    >
      {evaluations.isPending ? (
        <LoadingState />
      ) : evaluations.isError ? (
        <ErrorBanner error={evaluations.error} onRetry={() => void evaluations.refetch()} />
      ) : evaluations.data.length === 0 ? (
        <p className="text-sm text-zinc-600">{NO_EVALUATIONS_MESSAGE}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-100">
          {evaluations.data.map((evaluation) => {
            const view = getEvaluationViewState(evaluation, user.id);
            return (
              <li key={evaluation.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm font-medium text-zinc-900">{formatCycle(evaluation.cycle)}</span>
                <Badge tone={view.tone}>{view.label}</Badge>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
