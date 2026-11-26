import { Plus } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { SectionCard } from '../../../components/ui/Card';
import { formatCycle } from '../../../lib/dates';
import type { EvaluationDTO, UserDTO } from '../../../types/api';
import { useCurrentUser } from '../../auth/useAuth';
import { useTeam } from '../../team/hooks/useTeam';
import { EvaluationList } from '../components/EvaluationList';
import { NO_EVALUATIONS_MESSAGE } from '../components/messages';
import { OpenEvaluationDialog } from '../components/OpenEvaluationDialog';
import { useEvaluations } from '../hooks/useEvaluations';

const ownTitle = (evaluation: EvaluationDTO) => formatCycle(evaluation.cycle);

function CollaboratorEvaluations({ me }: { me: UserDTO }) {
  const evaluations = useEvaluations();
  return (
    <SectionCard title="Minhas avaliações">
      <EvaluationList query={evaluations} viewerId={me.id} titleFor={ownTitle} emptyTitle={NO_EVALUATIONS_MESSAGE} />
    </SectionCard>
  );
}

/** GESTOR: avaliações da equipe (sem `userId`) e as próprias como avaliado (`?userId=<me>`), spec 04 §4.2. */
function ManagerEvaluations({ me }: { me: UserDTO }) {
  const team = useTeam();
  const teamEvaluations = useEvaluations();
  const ownEvaluations = useEvaluations(me.id);
  const [opening, setOpening] = useState(false);

  const names = new Map((team.data ?? []).map((member) => [member.id, member.name]));
  const teamTitle = (evaluation: EvaluationDTO) =>
    `${names.get(evaluation.userId) ?? `Colaborador #${evaluation.userId}`} · ${formatCycle(evaluation.cycle)}`;
  const teamIsEmpty = team.isSuccess && team.data.length === 0;

  return (
    <>
      <SectionCard
        title="Avaliações da equipe"
        actions={
          <Button onClick={() => setOpening(true)} disabled={teamIsEmpty} title={teamIsEmpty ? 'Você ainda não tem liderados diretos.' : undefined}>
            <Plus aria-hidden="true" className="size-4" />
            Abrir avaliação
          </Button>
        }
      >
        <EvaluationList
          query={teamEvaluations}
          viewerId={me.id}
          titleFor={teamTitle}
          emptyTitle="Nenhuma avaliação aberta para a equipe."
        />
      </SectionCard>
      <SectionCard title="Minhas avaliações">
        <EvaluationList query={ownEvaluations} viewerId={me.id} titleFor={ownTitle} emptyTitle="Nenhuma avaliação aberta para você." />
      </SectionCard>
      {opening && <OpenEvaluationDialog team={team.data ?? []} onClose={() => setOpening(false)} />}
    </>
  );
}

export function EvaluationsPage() {
  const me = useCurrentUser();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Avaliações de desempenho"
        description="Ciclos semestrais com autoavaliação e avaliação do gestor. As notas são reveladas quando as duas partes forem enviadas."
      />
      {me.role === 'GESTOR' ? <ManagerEvaluations me={me} /> : <CollaboratorEvaluations me={me} />}
    </div>
  );
}
