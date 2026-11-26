import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Field } from '../../../components/ui/Field';
import { Input, Select, Textarea } from '../../../components/ui/Input';
import { ErrorBanner } from '../../../components/ui/States';
import { todayUtc } from '../../../lib/dates';
import { toFormErrors } from '../../../lib/form-errors';
import { GOAL_CATEGORIES, goalCategoryLabel } from '../../../lib/labels';
import type { GoalCategory, GoalDTO } from '../../../types/api';
import type { CreateGoalInput, UpdateGoalInput } from '../api';
import { useCreateGoal, useUpdateGoal } from '../hooks/useGoals';

type GoalField = 'title' | 'description' | 'category' | 'targetDate';
const FIELDS: readonly GoalField[] = ['title', 'description', 'category', 'targetDate'];

interface Values {
  title: string;
  description: string;
  category: GoalCategory;
  targetDate: string;
}

function validate(values: Values, today: string): Partial<Record<GoalField, string>> {
  const errors: Partial<Record<GoalField, string>> = {};
  const title = values.title.trim();
  if (title.length < 3 || title.length > 150) errors.title = 'Título deve ter entre 3 e 150 caracteres.';
  if (values.description.trim().length > 2000) errors.description = 'Descrição deve ter no máximo 2000 caracteres.';
  if (!values.targetDate) errors.targetDate = 'Informe o prazo.';
  else if (values.targetDate < today) errors.targetDate = 'Prazo não pode estar no passado.';
  return errors;
}

function toCreateInput(values: Values, userId: number | undefined): CreateGoalInput {
  const description = values.description.trim();
  return {
    title: values.title.trim(),
    category: values.category,
    targetDate: values.targetDate,
    ...(description ? { description } : {}),
    ...(userId === undefined ? {} : { userId }),
  };
}

/** Só os campos alterados; descrição apagada vira `null`. */
function toUpdateInput(values: Values, goal: GoalDTO): UpdateGoalInput {
  const changes: UpdateGoalInput = {};
  const title = values.title.trim();
  const description = values.description.trim() || null;
  if (title !== goal.title) changes.title = title;
  if (description !== goal.description) changes.description = description;
  if (values.category !== goal.category) changes.category = values.category;
  if (values.targetDate !== goal.targetDate) changes.targetDate = values.targetDate;
  return changes;
}

interface GoalFormDialogProps {
  onClose: () => void;
  /** Meta a editar; ausente = criação. */
  goal?: GoalDTO;
  /** Dono da nova meta quando o gestor cria para um liderado. */
  userId?: number;
}

export function GoalFormDialog({ goal, userId, onClose }: GoalFormDialogProps) {
  const isEdit = goal !== undefined;
  const create = useCreateGoal();
  const update = useUpdateGoal(goal?.id ?? 0);
  const mutation = isEdit ? update : create;
  const today = todayUtc();

  const [values, setValues] = useState<Values>({
    title: goal?.title ?? '',
    description: goal?.description ?? '',
    category: goal?.category ?? 'TECNICA',
    targetDate: goal?.targetDate ?? '',
  });
  const [clientErrors, setClientErrors] = useState<Partial<Record<GoalField, string>>>({});
  const serverErrors = mutation.isError ? toFormErrors(mutation.error, FIELDS) : null;
  const errors = { ...serverErrors?.fieldErrors, ...clientErrors };

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((current) => ({ ...current, [key]: value }));

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mutation.isPending) return;
    const validation = validate(values, today);
    setClientErrors(validation);
    if (Object.keys(validation).length > 0) return;

    if (goal) {
      const changes = toUpdateInput(values, goal);
      if (Object.keys(changes).length === 0) return onClose();
      update.mutate(changes, { onSuccess: onClose });
    } else {
      create.mutate(toCreateInput(values, userId), { onSuccess: onClose });
    }
  };

  return (
    <Dialog title={isEdit ? 'Editar meta' : 'Nova meta'} onClose={onClose}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        {serverErrors?.banner && <ErrorBanner error={serverErrors.banner} />}
        <Field label="Título" error={errors.title}>
          {(control) => <Input {...control} value={values.title} onChange={(e) => set('title', e.target.value)} />}
        </Field>
        <Field label="Descrição" error={errors.description} hint="Opcional.">
          {(control) => (
            <Textarea {...control} value={values.description} onChange={(e) => set('description', e.target.value)} />
          )}
        </Field>
        <Field label="Categoria" error={errors.category}>
          {(control) => (
            <Select {...control} value={values.category} onChange={(e) => set('category', e.target.value as GoalCategory)}>
              {GOAL_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {goalCategoryLabel(category)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Prazo" error={errors.targetDate}>
          {(control) => (
            <Input
              {...control}
              type="date"
              min={today}
              value={values.targetDate}
              onChange={(e) => set('targetDate', e.target.value)}
            />
          )}
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            Salvar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
