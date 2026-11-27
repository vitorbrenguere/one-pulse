import { CalendarDays } from 'lucide-react';
import { useId, useState } from 'react';
import { Badge, GOAL_STATUS_TONE } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/Dialog';
import { ProgressBar } from '../../../components/ui/ProgressBar';
import { ErrorBanner } from '../../../components/ui/States';
import { cn } from '../../../lib/cn';
import { formatDate, isOverdue, todayUtc } from '../../../lib/dates';
import { goalCategoryLabel, goalStatusLabel } from '../../../lib/labels';
import type { GoalDTO } from '../../../types/api';
import { useDeleteGoal } from '../hooks/useGoals';
import { FeedbackView } from './FeedbackView';
import { GoalFormDialog } from './GoalFormDialog';
import { GoalProgressForm } from './GoalProgressForm';
import { ManagerFeedbackForm } from './ManagerFeedbackForm';

export type GoalViewerMode = 'owner' | 'manager';

const isOpen = (goal: GoalDTO): goal is GoalDTO & { status: 'NAO_INICIADA' | 'EM_ANDAMENTO' } =>
  goal.status === 'NAO_INICIADA' || goal.status === 'EM_ANDAMENTO';

/** Uma meta (`<article>` nomeado pelo título). As ações dependem do papel do viewer (spec 03 §2.3). */
export function GoalCard({ goal, mode }: { goal: GoalDTO; mode: GoalViewerMode }) {
  const titleId = useId();
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useDeleteGoal(goal.id);
  const canEdit = mode === 'owner' && isOpen(goal);

  return (
    <article
      aria-labelledby={titleId}
      className="flex flex-col gap-5 rounded-3xl border border-purple-100/80 bg-white p-6 shadow-xs transition-shadow hover:shadow-md hover:shadow-purple-900/5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-3">
          <h3
            id={titleId}
            className={cn(
              'text-lg font-semibold tracking-tight text-zinc-900',
              goal.status === 'CANCELADA' && 'text-zinc-500 line-through',
            )}
          >
            {goal.title}
          </h3>
          <div className="flex flex-wrap gap-2">
            <Badge tone={GOAL_STATUS_TONE[goal.status]}>{goalStatusLabel(goal.status)}</Badge>
            <Badge>{goalCategoryLabel(goal.category)}</Badge>
            {isOverdue(goal, todayUtc()) && <Badge tone="red">Atrasada</Badge>}
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Editar
            </Button>
            {goal.status === 'NAO_INICIADA' && (
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                Excluir
              </Button>
            )}
          </div>
        )}
      </div>

      {goal.description && <p className="text-sm leading-relaxed whitespace-pre-line text-zinc-600">{goal.description}</p>}

      <div className="flex flex-col gap-3 border-t border-purple-100/70 pt-5">
        <div className="flex items-end justify-between gap-3">
          <span className="flex items-center gap-2 text-sm text-zinc-600">
            <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-purple-50 text-purple-600">
              <CalendarDays className="size-4" />
            </span>
            Prazo: {formatDate(goal.targetDate)}
          </span>
          <span className="text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums">{goal.progress}%</span>
        </div>
        <ProgressBar value={goal.progress} />
      </div>

      {remove.isError && <ErrorBanner error={remove.error} />}

      {canEdit && <GoalProgressForm key={`${goal.status}-${goal.progress}`} goal={goal} />}

      {mode === 'manager' ? (
        <ManagerFeedbackForm goal={goal} />
      ) : (
        goal.managerFeedback && <FeedbackView feedback={goal.managerFeedback} at={goal.managerFeedbackAt} />
      )}

      {editing && <GoalFormDialog goal={goal} onClose={() => setEditing(false)} />}
      {confirmDelete && (
        <ConfirmDialog
          title="Excluir meta?"
          message="A meta será removida definitivamente."
          danger
          pending={remove.isPending}
          onConfirm={() => remove.mutate(undefined, { onSettled: () => setConfirmDelete(false) })}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </article>
  );
}
