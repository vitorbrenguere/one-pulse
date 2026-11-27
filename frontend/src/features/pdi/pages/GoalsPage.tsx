import { Plus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Select } from '../../../components/ui/Input';
import { GOAL_STATUSES, goalStatusLabel, isGoalStatus } from '../../../lib/labels';
import { GoalFormDialog } from '../components/GoalFormDialog';
import { GoalList } from '../components/GoalList';
import { useGoals } from '../hooks/useGoals';

/** Minhas metas (spec 05 §6.4). Filtro e diálogo de criação vivem na URL (`?status=`, `?new=1`). */
export function GoalsPage() {
  const goals = useGoals();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawStatus = searchParams.get('status');
  const status = isGoalStatus(rawStatus) ? rawStatus : null;
  const creating = searchParams.get('new') === '1';

  const updateParams = (change: (params: URLSearchParams) => void) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      change(next);
      return next;
    });
  };

  const setStatus = (value: string) =>
    updateParams((params) => (isGoalStatus(value) ? params.set('status', value) : params.delete('status')));
  const setCreating = (open: boolean) =>
    updateParams((params) => (open ? params.set('new', '1') : params.delete('new')));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Metas de PDI"
        description="Acompanhe seu plano de desenvolvimento individual."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" className="size-4" />
            Nova meta
          </Button>
        }
      >
        <div className="w-full max-w-xs">
          <Field label="Filtrar por status">
            {(control) => (
              <Select {...control} className="rounded-full" value={status ?? ''} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todas</option>
                {GOAL_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {goalStatusLabel(option)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </PageHeader>

      <GoalList
        query={goals}
        mode="owner"
        {...(status ? { filter: (goal) => goal.status === status } : {})}
        emptyTitle="Você ainda não tem metas de PDI."
        emptyAction={<Button onClick={() => setCreating(true)}>Criar meta</Button>}
      />

      {creating && <GoalFormDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
