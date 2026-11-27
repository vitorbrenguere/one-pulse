import { useState, type FormEvent } from 'react';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { SectionCard } from '../../../components/ui/Card';
import { Field } from '../../../components/ui/Field';
import { Input } from '../../../components/ui/Input';
import { ErrorBanner } from '../../../components/ui/States';
import { toFormErrors } from '../../../lib/form-errors';
import { roleLabel } from '../../../lib/labels';
import type { UserDTO } from '../../../types/api';
import { useCurrentUser } from '../../auth/useAuth';
import type { ProfileChanges } from '../api';
import { useUpdateProfile } from '../hooks/useUpdateProfile';

const FIELDS = ['name', 'jobTitle'] as const;

/** Só os campos alterados; cargo vazio vira `null` (spec 02 D-07). */
function diffProfile(user: UserDTO, name: string, jobTitle: string): ProfileChanges {
  const changes: ProfileChanges = {};
  const nextName = name.trim();
  const nextJobTitle = jobTitle.trim() || null;
  if (nextName !== user.name) changes.name = nextName;
  if (nextJobTitle !== user.jobTitle) changes.jobTitle = nextJobTitle;
  return changes;
}

function ProfileForm({ user, onDone }: { user: UserDTO; onDone: () => void }) {
  const update = useUpdateProfile();
  const [name, setName] = useState(user.name);
  const [jobTitle, setJobTitle] = useState(user.jobTitle ?? '');
  const changes = diffProfile(user, name, jobTitle);
  const hasChanges = Object.keys(changes).length > 0;
  const errors = update.isError ? toFormErrors(update.error, FIELDS) : null;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasChanges || update.isPending) return;
    update.mutate(changes, { onSuccess: onDone });
  };

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {errors?.banner && <ErrorBanner error={errors.banner} />}
      <Field label="Nome" error={errors?.fieldErrors.name}>
        {(control) => <Input {...control} value={name} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field label="Cargo" error={errors?.fieldErrors.jobTitle} hint="Deixe em branco para remover o cargo.">
        {(control) => <Input {...control} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />}
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!hasChanges || update.isPending}>
          Salvar
        </Button>
      </div>
    </form>
  );
}

export function ProfileCard() {
  const user = useCurrentUser();
  const [editing, setEditing] = useState(false);

  return (
    <SectionCard
      title="Meu perfil"
      actions={
        !editing && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            Editar perfil
          </Button>
        )
      }
    >
      {editing ? (
        <ProfileForm user={user} onDone={() => setEditing(false)} />
      ) : (
        <dl className="flex flex-col divide-y divide-purple-100/70 text-sm">
          <div className="flex flex-col gap-0.5 pb-3">
            <dt className="text-xs tracking-wide text-zinc-500 uppercase">Nome</dt>
            <dd className="font-semibold text-zinc-900">{user.name}</dd>
          </div>
          <div className="flex flex-col gap-0.5 py-3">
            <dt className="text-xs tracking-wide text-zinc-500 uppercase">E-mail</dt>
            <dd className="break-all text-zinc-900">{user.email}</dd>
          </div>
          <div className="flex flex-col gap-0.5 py-3">
            <dt className="text-xs tracking-wide text-zinc-500 uppercase">Cargo</dt>
            <dd className="text-zinc-900">{user.jobTitle ?? 'Cargo não informado'}</dd>
          </div>
          <div className="flex items-center justify-between gap-2 pt-3">
            <dt className="text-xs tracking-wide text-zinc-500 uppercase">Papel</dt>
            <dd>
              <Badge tone="violet">{roleLabel(user.role)}</Badge>
            </dd>
          </div>
        </dl>
      )}
    </SectionCard>
  );
}
