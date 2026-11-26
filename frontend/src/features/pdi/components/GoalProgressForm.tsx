import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/Dialog';
import { Field } from '../../../components/ui/Field';
import { Input, Select } from '../../../components/ui/Input';
import { ErrorBanner } from '../../../components/ui/States';
import { goalStatusLabel } from '../../../lib/labels';
import type { GoalDTO, GoalStatus } from '../../../types/api';
import type { UpdateGoalInput } from '../api';
import { useUpdateGoal } from '../hooks/useGoals';

/** Transições válidas a partir de cada status não terminal (spec 03 §2.4). */
const NEXT_STATUSES: Record<'NAO_INICIADA' | 'EM_ANDAMENTO', GoalStatus[]> = {
  NAO_INICIADA: ['NAO_INICIADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA'],
  EM_ANDAMENTO: ['EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA'],
};

const isTerminal = (status: GoalStatus) => status === 'CONCLUIDA' || status === 'CANCELADA';

/**
 * Monta um payload que nunca contradiz `status` × `progress` (spec 03 §2.5):
 * status terminal vai sozinho; caso contrário, só o que mudou.
 */
export function buildProgressChanges(goal: GoalDTO, status: GoalStatus, progress: number): UpdateGoalInput {
  if (status !== goal.status && isTerminal(status)) return { status };
  const changes: UpdateGoalInput = {};
  if (status !== goal.status) changes.status = status;
  if (progress !== goal.progress) changes.progress = progress;
  return changes;
}

function confirmationFor(changes: UpdateGoalInput): { title: string; message: string } | null {
  if (changes.status === 'CANCELADA') return { title: 'Cancelar meta?', message: 'Cancelar é definitivo: a meta não poderá mais ser alterada.' };
  if (changes.status === 'CONCLUIDA' || changes.progress === 100) {
    return { title: 'Concluir meta?', message: 'Concluir é definitivo: a meta não poderá mais ser alterada.' };
  }
  return null;
}

export function GoalProgressForm({ goal }: { goal: GoalDTO & { status: 'NAO_INICIADA' | 'EM_ANDAMENTO' } }) {
  const update = useUpdateGoal(goal.id);
  const [status, setStatus] = useState<GoalStatus>(goal.status);
  const [progressText, setProgressText] = useState(String(goal.progress));
  const [progressError, setProgressError] = useState<string | undefined>(undefined);
  const [pendingChanges, setPendingChanges] = useState<UpdateGoalInput | null>(null);

  const progress = Number(progressText);
  const progressValid = progressText.trim() !== '' && Number.isInteger(progress) && progress >= 0 && progress <= 100;
  const changes = progressValid ? buildProgressChanges(goal, status, progress) : {};
  const hasChanges = !progressValid || Object.keys(changes).length > 0;

  const send = (payload: UpdateGoalInput) => update.mutate(payload, { onSettled: () => setPendingChanges(null) });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (update.isPending) return;
    if (!progressValid) {
      setProgressError('Informe um progresso inteiro entre 0 e 100.');
      return;
    }
    setProgressError(undefined);
    if (Object.keys(changes).length === 0) return;
    if (confirmationFor(changes)) setPendingChanges(changes);
    else send(changes);
  };

  const confirmation = pendingChanges ? confirmationFor(pendingChanges) : null;

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3 rounded-md bg-zinc-50 p-3">
      {update.isError && <ErrorBanner error={update.error} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-1.5">
          <Field label="Progresso (%)" error={progressError} hint="Ao chegar a 100%, a meta será concluída.">
            {(control) => (
              <Input
                {...control}
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                value={progressText}
                onChange={(e) => setProgressText(e.target.value)}
              />
            )}
          </Field>
          <input
            type="range"
            min={0}
            max={100}
            aria-label="Ajustar progresso"
            value={progressValid ? progress : goal.progress}
            onChange={(e) => setProgressText(e.target.value)}
            className="accent-zinc-900"
          />
        </div>
        <Field label="Status" hint="Concluir ou cancelar é definitivo.">
          {(control) => (
            <Select {...control} value={status} onChange={(e) => setStatus(e.target.value as GoalStatus)}>
              {NEXT_STATUSES[goal.status].map((option) => (
                <option key={option} value={option}>
                  {goalStatusLabel(option)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!hasChanges || update.isPending}>
          Salvar progresso
        </Button>
      </div>

      {pendingChanges && confirmation && (
        <ConfirmDialog
          title={confirmation.title}
          message={confirmation.message}
          pending={update.isPending}
          onConfirm={() => send(pendingChanges)}
          onCancel={() => setPendingChanges(null)}
        />
      )}
    </form>
  );
}
