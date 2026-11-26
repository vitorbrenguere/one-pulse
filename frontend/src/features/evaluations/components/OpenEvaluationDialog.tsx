import { useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Field } from '../../../components/ui/Field';
import { Select } from '../../../components/ui/Input';
import { ErrorBanner } from '../../../components/ui/States';
import { cycleOptions } from '../../../lib/dates';
import { toFormErrors } from '../../../lib/form-errors';
import type { UserDTO } from '../../../types/api';
import { useOpenEvaluation } from '../hooks/useEvaluations';

interface OpenEvaluationDialogProps {
  team: UserDTO[];
  initialUserId?: number;
  onClose: () => void;
}

/** Abertura de avaliação pelo gestor: liderado + ciclo (anterior, atual, próximo — spec 05 Q-06). */
export function OpenEvaluationDialog({ team, initialUserId, onClose }: OpenEvaluationDialogProps) {
  const open = useOpenEvaluation();
  const [options] = useState(() => cycleOptions());
  const [userId, setUserId] = useState(initialUserId ? String(initialUserId) : '');
  const [cycle, setCycle] = useState(() => options.find((o) => o.isCurrent)?.value ?? '');
  const [userError, setUserError] = useState<string | undefined>(undefined);
  const serverErrors = open.isError ? toFormErrors(open.error, ['userId', 'cycle']) : null;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (open.isPending) return;
    if (!userId) {
      setUserError('Selecione um colaborador.');
      return;
    }
    setUserError(undefined);
    open.mutate({ userId: Number(userId), cycle }, { onSuccess: onClose });
  };

  return (
    <Dialog title="Abrir avaliação" onClose={onClose}>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
        {serverErrors?.banner && <ErrorBanner error={serverErrors.banner} />}
        <Field label="Colaborador" error={userError ?? serverErrors?.fieldErrors.userId}>
          {(control) => (
            <Select {...control} value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Selecione…</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Ciclo" error={serverErrors?.fieldErrors.cycle}>
          {(control) => (
            <Select {...control} value={cycle} onChange={(e) => setCycle(e.target.value)}>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={open.isPending}>
            Abrir avaliação
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
