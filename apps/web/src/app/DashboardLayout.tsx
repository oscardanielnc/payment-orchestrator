import type { Organization } from '@po/contracts';
import { AppShell, navLinkClass } from '@po/ui/layout/AppShell/AppShell';
import { Button } from '@po/ui/primitives/Button/Button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { api } from '../lib/api-client';
import { useSession } from '../lib/session-store';

const NAV = [
  {
    group: 'Payments',
    items: [
      { label: 'Charges', href: '/charges' },
      { label: 'Balances', href: '/balances' },
    ],
  },
  {
    group: 'Developers',
    items: [
      { label: 'API keys', href: '/api-keys' },
      { label: 'Webhooks', href: '/webhooks' },
    ],
  },
];

export function DashboardLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, clear } = useSession();
  const organization = useQuery({
    queryKey: ['organization'],
    queryFn: () => api<Organization>('/organization'),
  });

  const signOut = async () => {
    await api<void>('/auth/logout', { method: 'POST' }).catch(() => undefined);
    clear();
    // Another merchant signing in on this browser must not see cached data.
    queryClient.clear();
    void navigate('/login', { replace: true });
  };

  return (
    <AppShell
      organizationName={organization.data?.name ?? '…'}
      nav={NAV}
      renderLink={(item) => (
        <NavLink to={item.href} className={({ isActive }) => navLinkClass(isActive)}>
          {item.label}
        </NavLink>
      )}
      userSlot={
        <div className="flex flex-col gap-2">
          <p className="truncate text-[13px] text-muted">
            {user?.email} · {user?.role}
          </p>
          <Button variant="secondary" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      }
    >
      <Outlet />
    </AppShell>
  );
}
