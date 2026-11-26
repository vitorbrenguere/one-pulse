import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '../../../components/ui/Button';
import { SectionCard } from '../../../components/ui/Card';
import { ErrorBanner, LoadingState } from '../../../components/ui/States';
import { formatCycle } from '../../../lib/dates';
import { NotFoundView } from '../../../routes/NotFoundPage';
import { ApiError } from '../../../services/http';
import type { EvaluationDTO, UserDTO } from '../../../types/api';
import { useCurrentUser } from '../../auth/useAuth';
import { EvaluationList } from '../../evaluations/components/EvaluationList';
import { OpenEvaluationDialog } from '../../evaluations/components/OpenEvaluationDialog';
import { useEvaluations } from '../../evaluations/hooks/useEvaluations';
import { GoalFormDialog } from '../../pdi/components/GoalFormDialog';
import { GoalList } from '../../pdi/components/GoalList';
import { useGoals } from '../../pdi/hooks/useGoals';
import { useUser } from '../hooks/useTeam';

const ID_PATTERN = /^[1-9]\d{0,9}$/;
const MAX_ID = 4294967295;

/** Mesmo formato de id da API (spec 02 §3.1): fora dele, nem consulta. */
function parseUserId(raw: string | undefined): number | null {
  if (!raw || !ID_PATTERN.test(raw)) return null;
  const id = Number(raw);
  return id <= MAX_ID ? id : null;
}

function MemberNotFound() {
  return (
    <NotFoundView
      title="Colaborador não encontrado"
      description="Este colaborador não existe ou não faz parte da sua equipe."
    />
  );
}

function MemberDetails({ member }: { member: UserDTO }) {
  const me = useCurrentUser();
  const goals = useGoals(member.id);
  const evaluations = useEvaluations(member.id);
  const [creatingGoal, setCreatingGoal] = useState(false);
  const [openingEvaluation, setOpeningEvaluation] = useState(false);
  const cycleTitle = (evaluation: EvaluationDTO) => formatCycle(evaluation.cycle);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={member.name}
        description={
          <div className="flex flex-wrap gap-x-3">
            {member.jobTitle && <span>{member.jobTitle}</span>}
            <span>{member.email}</span>
          </div>
        }
      />

      <SectionCard
        title="Metas"
        actions={
          <Button size="sm" onClick={() => setCreatingGoal(true)}>
            <Plus aria-hidden="true" className="size-4" />
            {`Nova meta para ${member.name}`}
          </Button>
        }
      >
        <GoalList query={goals} mode="manager" emptyTitle={`${member.name} ainda não tem metas de PDI.`} />
      </SectionCard>

      <SectionCard
        title="Avaliações"
        actions={
          <Button size="sm" onClick={() => setOpeningEvaluation(true)}>
            <Plus aria-hidden="true" className="size-4" />
            Abrir avaliação
          </Button>
        }
      >
        <EvaluationList
          query={evaluations}
          viewerId={me.id}
          titleFor={cycleTitle}
          emptyTitle="Nenhuma avaliação aberta para este colaborador."
        />
      </SectionCard>

      {creatingGoal && <GoalFormDialog userId={member.id} onClose={() => setCreatingGoal(false)} />}
      {openingEvaluation && (
        <OpenEvaluationDialog team={[member]} initialUserId={member.id} onClose={() => setOpeningEvaluation(false)} />
      )}
    </div>
  );
}

function TeamMember({ userId }: { userId: number }) {
  const member = useUser(userId);
  if (member.isPending) return <LoadingState />;
  if (member.isError) {
    if (member.error instanceof ApiError && member.error.status === 404) return <MemberNotFound />;
    return <ErrorBanner error={member.error} onRetry={() => void member.refetch()} />;
  }
  return <MemberDetails member={member.data} />;
}

/** Acompanhamento de um liderado pelo gestor (spec 05 §6.3). */
export function TeamMemberPage() {
  const userId = parseUserId(useParams().userId);
  if (userId === null) return <MemberNotFound />;
  return <TeamMember key={userId} userId={userId} />;
}
