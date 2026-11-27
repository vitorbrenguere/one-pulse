import type { ReactNode } from 'react';
import { EmptyState, ErrorBanner, LoadingState } from '../../../components/ui/States';
import type { GoalDTO } from '../../../types/api';
import type { useGoals } from '../hooks/useGoals';
import { GoalCard, type GoalViewerMode } from './GoalCard';

interface GoalListProps {
  query: ReturnType<typeof useGoals>;
  mode: GoalViewerMode;
  /** Filtro aplicado no cliente (spec 05 D-05). */
  filter?: (goal: GoalDTO) => boolean;
  emptyTitle: string;
  emptyAction?: ReactNode;
}

export function GoalList({ query, mode, filter, emptyTitle, emptyAction }: GoalListProps) {
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorBanner error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.length === 0) return <EmptyState title={emptyTitle} action={emptyAction} />;

  const goals = filter ? query.data.filter(filter) : query.data;
  if (goals.length === 0) return <EmptyState title="Nenhuma meta com este status." />;

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {goals.map((goal) => (
        <GoalCard key={goal.id} goal={goal} mode={mode} />
      ))}
    </div>
  );
}
