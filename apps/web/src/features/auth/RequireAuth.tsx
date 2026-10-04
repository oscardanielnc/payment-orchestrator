import { Skeleton } from '@po/ui/feedback/States/States';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSession } from '../../lib/session-store';

/** Waits for the startup refresh, then lets signed-in users through or sends them to sign in. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { ready, accessToken } = useSession();
  const location = useLocation();

  if (!ready) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Skeleton rows={2} label="Restoring your session" />
      </div>
    );
  }
  if (!accessToken) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
