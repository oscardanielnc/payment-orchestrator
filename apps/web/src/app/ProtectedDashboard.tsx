import { RequireAuth } from '../features/auth/RequireAuth';
import { DashboardLayout } from './DashboardLayout';

export function ProtectedDashboard() {
  return (
    <RequireAuth>
      <DashboardLayout />
    </RequireAuth>
  );
}
