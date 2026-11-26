import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { LoginPage } from '../features/auth/pages/LoginPage';
import { RegisterPage } from '../features/auth/pages/RegisterPage';
import { DashboardPage } from '../features/dashboard/pages/DashboardPage';
import { EvaluationsPage } from '../features/evaluations/pages/EvaluationsPage';
import { GoalsPage } from '../features/pdi/pages/GoalsPage';
import { TeamMemberPage } from '../features/team/pages/TeamMemberPage';
import { PublicOnly, RequireAuth, RequireRole } from './guards';
import { NotFoundPage } from './NotFoundPage';

/** Tabela de rotas e guards (spec 05 §5). */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/evaluations" element={<EvaluationsPage />} />
          <Route element={<RequireRole role="GESTOR" />}>
            <Route path="/team/:userId" element={<TeamMemberPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
