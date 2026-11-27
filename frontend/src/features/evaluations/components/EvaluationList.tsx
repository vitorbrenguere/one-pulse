import { EmptyState, ErrorBanner, LoadingState } from '../../../components/ui/States';
import type { EvaluationDTO } from '../../../types/api';
import type { useEvaluations } from '../hooks/useEvaluations';
import { EvaluationCard } from './EvaluationCard';

interface EvaluationListProps {
  query: ReturnType<typeof useEvaluations>;
  viewerId: number;
  titleFor: (evaluation: EvaluationDTO) => string;
  emptyTitle: string;
}

export function EvaluationList({ query, viewerId, titleFor, emptyTitle }: EvaluationListProps) {
  if (query.isPending) return <LoadingState />;
  if (query.isError) return <ErrorBanner error={query.error} onRetry={() => void query.refetch()} />;
  if (query.data.length === 0) return <EmptyState title={emptyTitle} />;

  return (
    <div className="grid gap-5">
      {query.data.map((evaluation) => (
        <EvaluationCard key={evaluation.id} evaluation={evaluation} viewerId={viewerId} title={titleFor(evaluation)} />
      ))}
    </div>
  );
}
