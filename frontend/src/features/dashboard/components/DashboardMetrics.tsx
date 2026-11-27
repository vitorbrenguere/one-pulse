import type { GoalDTO } from '../../../types/api';
import { useCurrentUser } from '../../auth/useAuth';
import { useEvaluations } from '../../evaluations/hooks/useEvaluations';
import { useGoals } from '../../pdi/hooks/useGoals';
import { useTeam } from '../../team/hooks/useTeam';
import { pendingUserIds } from './pending';

const PLACEHOLDER = '—';
const isActive = (goal: GoalDTO) => goal.status === 'NAO_INICIADA' || goal.status === 'EM_ANDAMENTO';

function averageProgress(goals: GoalDTO[]): number | null {
  const active = goals.filter(isActive);
  if (active.length === 0) return null;
  return Math.round(active.reduce((sum, goal) => sum + goal.progress, 0) / active.length);
}

/** Anel de progresso decorativo; o valor acessível é o texto do `<dd>`. */
function ProgressRing({ value }: { value: number | null }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - (value ?? 0) / 100);
  return (
    <svg aria-hidden="true" viewBox="0 0 80 80" className="absolute inset-0 size-full -rotate-90">
      <circle cx="40" cy="40" r={radius} fill="none" strokeWidth="8" className="stroke-white/10" />
      <circle
        cx="40"
        cy="40"
        r={radius}
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="stroke-purple-400 transition-[stroke-dashoffset] duration-700"
      />
    </svg>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-purple-200">{label}</dt>
      <dd className="text-4xl font-semibold tracking-tight text-white tabular-nums sm:text-5xl">{value}</dd>
    </div>
  );
}

function ProgressMetric({ goals }: { goals: GoalDTO[] | undefined }) {
  const average = goals ? averageProgress(goals) : null;
  return (
    <div className="flex items-center gap-4">
      <dt className="max-w-24 text-sm leading-snug text-purple-200">Progresso médio das metas ativas</dt>
      <dd className="relative order-first flex size-20 items-center justify-center text-lg font-semibold text-white tabular-nums">
        <ProgressRing value={average} />
        {average === null ? PLACEHOLDER : `${average}%`}
      </dd>
    </div>
  );
}

const count = (value: number | undefined) => (value === undefined ? PLACEHOLDER : String(value));

function ManagerMetrics({ managerId }: { managerId: number }) {
  const goals = useGoals();
  const team = useTeam();
  const evaluations = useEvaluations();
  return (
    <>
      <ProgressMetric goals={goals.data} />
      <Metric label="Liderados" value={count(team.data?.length)} />
      <Metric label="Avaliações pendentes" value={count(evaluations.data && pendingUserIds(evaluations.data, managerId).size)} />
    </>
  );
}

function CollaboratorMetrics() {
  const goals = useGoals();
  return (
    <>
      <ProgressMetric goals={goals.data} />
      <Metric label="Metas ativas" value={count(goals.data?.filter(isActive).length)} />
      <Metric label="Metas concluídas" value={count(goals.data?.filter((goal) => goal.status === 'CONCLUIDA').length)} />
    </>
  );
}

/**
 * Indicadores do hero do dashboard. Reaproveitam as mesmas queries dos cards (mesma query key →
 * nenhuma requisição extra); COLABORADOR nunca consulta a equipe.
 */
export function DashboardMetrics() {
  const user = useCurrentUser();
  return (
    <dl aria-label="Indicadores" className="flex flex-wrap items-center gap-x-12 gap-y-6">
      {user.role === 'GESTOR' ? <ManagerMetrics managerId={user.id} /> : <CollaboratorMetrics />}
    </dl>
  );
}
