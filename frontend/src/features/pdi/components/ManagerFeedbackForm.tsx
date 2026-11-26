import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/Dialog';
import { Field } from '../../../components/ui/Field';
import { Textarea } from '../../../components/ui/Input';
import { ErrorBanner } from '../../../components/ui/States';
import { toFormErrors } from '../../../lib/form-errors';
import type { GoalDTO } from '../../../types/api';
import { useUpdateGoal } from '../hooks/useGoals';
import { FeedbackView } from './FeedbackView';

function validateFeedback(text: string): string | undefined {
  const value = text.trim();
  if (!value) return 'Escreva o parecer antes de salvar.';
  if (value.length > 2000) return 'O parecer deve ter no máximo 2000 caracteres.';
  return undefined;
}

/** Parecer do gestor direto: criar, editar e remover, inclusive em meta terminal (spec 03 D-05). */
export function ManagerFeedbackForm({ goal }: { goal: GoalDTO }) {
  const update = useUpdateGoal(goal.id);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(goal.managerFeedback ?? '');
  const [clientError, setClientError] = useState<string | undefined>(undefined);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const serverErrors = update.isError ? toFormErrors(update.error, ['managerFeedback']) : null;

  if (goal.managerFeedback && !editing) {
    return (
      <div className="flex flex-col gap-2">
        {serverErrors?.banner && <ErrorBanner error={serverErrors.banner} />}
        <FeedbackView feedback={goal.managerFeedback} at={goal.managerFeedbackAt} />
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setText(goal.managerFeedback ?? '');
              setEditing(true);
            }}
          >
            Editar parecer
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirmRemove(true)}>
            Remover parecer
          </Button>
        </div>
        {confirmRemove && (
          <ConfirmDialog
            title="Remover parecer?"
            message="O parecer será apagado desta meta."
            danger
            pending={update.isPending}
            onConfirm={() =>
              update.mutate({ managerFeedback: null }, { onSettled: () => setConfirmRemove(false), onSuccess: () => setText('') })
            }
            onCancel={() => setConfirmRemove(false)}
          />
        )}
      </div>
    );
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (update.isPending) return;
    const error = validateFeedback(text);
    setClientError(error);
    if (error) return;
    update.mutate({ managerFeedback: text.trim() }, { onSuccess: () => setEditing(false) });
  };

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-2">
      {serverErrors?.banner && <ErrorBanner error={serverErrors.banner} />}
      <Field label="Parecer do gestor" error={clientError ?? serverErrors?.fieldErrors.managerFeedback}>
        {(control) => <Textarea {...control} value={text} onChange={(e) => setText(e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2">
        {editing && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
        )}
        <Button type="submit" size="sm" disabled={update.isPending}>
          Salvar parecer
        </Button>
      </div>
    </form>
  );
}
