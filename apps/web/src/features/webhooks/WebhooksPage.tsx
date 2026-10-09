import { PageHeader } from '@po/ui/layout/AppShell/AppShell';
import { useSession } from '../../lib/session-store';
import { DeliveriesPanel } from './DeliveriesPanel';
import { EndpointsPanel } from './EndpointsPanel';

export function WebhooksPage() {
  const isOwner = useSession((s) => s.user?.role === 'owner');

  return (
    <>
      <PageHeader title="Webhooks">
        <p className="text-sm text-muted">
          Signed HTTPS notifications to your server, retried until it answers 2xx.
        </p>
      </PageHeader>
      {isOwner ? (
        <EndpointsPanel />
      ) : (
        <p className="text-sm text-muted">Only owners can add or disable endpoints.</p>
      )}
      <DeliveriesPanel />
    </>
  );
}
