import { PageHeader } from '../../../components/layout/PageHeader';
import { useCurrentUser } from '../../auth/useAuth';
import { ProfileCard } from '../../profile/components/ProfileCard';
import { EvaluationsSummary } from '../components/EvaluationsSummary';
import { GoalsSummary } from '../components/GoalsSummary';
import { TeamSection } from '../components/TeamSection';

export function DashboardPage() {
  const user = useCurrentUser();
  const isManager = user.role === 'GESTOR';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard" description={`Olá, ${user.name.split(' ')[0] ?? user.name}.`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {isManager && <TeamSection />}
          <GoalsSummary />
          {!isManager && <EvaluationsSummary />}
        </div>
        <ProfileCard />
      </div>
    </div>
  );
}
