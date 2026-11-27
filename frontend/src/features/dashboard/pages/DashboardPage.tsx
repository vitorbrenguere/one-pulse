import { PageHeader } from '../../../components/layout/PageHeader';
import { useCurrentUser } from '../../auth/useAuth';
import { ProfileCard } from '../../profile/components/ProfileCard';
import { DashboardMetrics } from '../components/DashboardMetrics';
import { EvaluationsSummary } from '../components/EvaluationsSummary';
import { GoalsSummary } from '../components/GoalsSummary';
import { TeamSection } from '../components/TeamSection';

/**
 * Bento grid: o card escuro de destaque (equipe para o GESTOR, metas para o COLABORADOR)
 * ocupa duas colunas; perfil e resumos secundários ficam em cards claros.
 */
export function DashboardPage() {
  const user = useCurrentUser();
  const isManager = user.role === 'GESTOR';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description={`Olá, ${user.name.split(' ')[0] ?? user.name}.`}
        aside={<DashboardMetrics />}
      />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {isManager ? (
            <>
              <TeamSection />
              <GoalsSummary />
            </>
          ) : (
            <GoalsSummary tone="dark" />
          )}
        </div>
        <div className="flex flex-col gap-6">
          <ProfileCard />
          {!isManager && <EvaluationsSummary />}
        </div>
      </div>
    </div>
  );
}
