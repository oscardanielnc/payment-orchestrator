import type { LedgerEntry, PaymentAttempt } from '@po/contracts';
import { Amount } from '@po/ui/data-display/Amount/Amount';
import { DataTable } from '@po/ui/data-display/DataTable/DataTable';
import { PaymentRail } from '@po/ui/data-display/PaymentRail/PaymentRail';
import { StatusChip } from '@po/ui/data-display/StatusChip/StatusChip';
import { EmptyState, ErrorState, Skeleton } from '@po/ui/feedback/States/States';
import { PageHeader, Panel } from '@po/ui/layout/AppShell/AppShell';
import { Link, useParams } from 'react-router';
import { ApiError } from '../../lib/api-client';
import { useCharge, useChargeExtras } from './api';
import { railStations } from './rail';

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'medium' });

/** `charge.succeeded` → `Succeeded`, `payment_attempt.started` → `Payment attempt started`. */
const eventLabel = (type: string) => {
  const [entity = '', action = ''] = type.split('.');
  const text = entity === 'charge' ? action : `${entity.replace(/_/g, ' ')} ${action}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const ATTEMPT_COLUMNS = [
  { header: 'Method', cell: (a: PaymentAttempt) => a.method },
  { header: 'Provider', cell: (a: PaymentAttempt) => a.provider },
  { header: 'Status', cell: (a: PaymentAttempt) => a.status },
  { header: 'Last decline', cell: (a: PaymentAttempt) => a.failureReason ?? '—' },
  { header: 'Started', cell: (a: PaymentAttempt) => dateTime(a.createdAt) },
];

const LEDGER_COLUMNS = [
  {
    header: 'Account',
    cell: (e: LedgerEntry) => <span className="font-mono text-[13px]">{e.account}</span>,
  },
  { header: 'Status', cell: (e: LedgerEntry) => e.status },
  {
    header: 'Debit',
    align: 'right' as const,
    cell: (e: LedgerEntry) =>
      e.direction === 'debit' ? <Amount value={e.amount} currency={e.currency} /> : '',
  },
  {
    header: 'Credit',
    align: 'right' as const,
    cell: (e: LedgerEntry) =>
      e.direction === 'credit' ? <Amount value={e.amount} currency={e.currency} /> : '',
  },
];

export function ChargeDetailPage() {
  const { id = '' } = useParams();
  const charge = useCharge(id);
  const { attempts, events, ledger } = useChargeExtras(id, charge.data?.status);

  if (charge.isPending) return <Skeleton rows={6} label="Loading charge" />;
  if (charge.isError) {
    const notFound = charge.error instanceof ApiError && charge.error.status === 404;
    return notFound ? (
      <EmptyState title="Charge not found">
        <Link to="/charges" className="text-accent underline">
          Back to charges
        </Link>
      </EmptyState>
    ) : (
      <ErrorState message="Could not load this charge." onRetry={() => void charge.refetch()} />
    );
  }

  const c = charge.data;
  const attemptRows = attempts.data?.data ?? [];
  const ledgerRows = ledger.data?.data ?? [];

  return (
    <>
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link to="/charges" className="hover:underline">
          Charges
        </Link>{' '}
        / <span className="font-mono">{c.id.slice(0, 8)}</span>
      </nav>

      <PageHeader title={c.description ?? 'Charge'}>
        <div className="flex flex-wrap items-center gap-3">
          <Amount value={c.amount} currency={c.currency} size="hero" />
          <StatusChip status={c.status} />
        </div>
      </PageHeader>

      <Panel title="Payment rail">
        <PaymentRail stations={railStations(c, attemptRows, ledgerRows)} />
      </Panel>

      <div className="grid gap-6 min-[1100px]:grid-cols-2">
        <Panel title="Details">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted">ID</dt>
            <dd className="font-mono text-[13px] break-all">{c.id}</dd>
            <dt className="text-muted">Reference</dt>
            <dd className="font-mono text-[13px]">{c.reference ?? '—'}</dd>
            <dt className="text-muted">Created</dt>
            <dd>{dateTime(c.createdAt)}</dd>
            <dt className="text-muted">Expires</dt>
            <dd>{dateTime(c.expiresAt)}</dd>
          </dl>
        </Panel>

        <Panel title="Timeline">
          {events.isPending ? (
            <Skeleton rows={3} label="Loading timeline" />
          ) : (
            <ol className="flex flex-col gap-2 text-sm">
              {(events.data?.data ?? []).map((event, index) => (
                <li key={`${event.type}-${index}`} className="flex justify-between gap-4">
                  <span>{eventLabel(event.type)}</span>
                  <time className="text-muted" dateTime={event.occurredAt}>
                    {dateTime(event.occurredAt)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <Panel title="Payment attempts">
        {attemptRows.length === 0 ? (
          <p className="text-sm text-muted">The customer has not chosen a payment method yet.</p>
        ) : (
          <DataTable
            caption="Payment attempts"
            columns={ATTEMPT_COLUMNS}
            rows={attemptRows}
            rowKey={(a) => a.id}
          />
        )}
      </Panel>

      <Panel title="Ledger entries">
        {ledgerRows.length === 0 ? (
          <p className="text-sm text-muted">Nothing posted yet: entries appear when money moves.</p>
        ) : (
          <DataTable
            caption="Ledger entries"
            columns={LEDGER_COLUMNS}
            rows={ledgerRows}
            rowKey={(e) => `${e.transactionId}-${e.account}-${e.direction}`}
          />
        )}
      </Panel>
    </>
  );
}
