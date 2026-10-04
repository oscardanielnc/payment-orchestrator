import type { Charge, ChargeStatus } from '@po/contracts';
import { Amount } from '@po/ui/data-display/Amount/Amount';
import { DataTable } from '@po/ui/data-display/DataTable/DataTable';
import { StatusChip } from '@po/ui/data-display/StatusChip/StatusChip';
import { EmptyState, ErrorState, Skeleton } from '@po/ui/feedback/States/States';
import { PageHeader } from '@po/ui/layout/AppShell/AppShell';
import { Button } from '@po/ui/primitives/Button/Button';
import { useNavigate, useSearchParams } from 'react-router';
import { useCharges } from './api';

const FILTERS: { label: string; value?: ChargeStatus }[] = [
  { label: 'All' },
  { label: 'Pending', value: 'pending' },
  { label: 'Processing', value: 'processing' },
  { label: 'Succeeded', value: 'succeeded' },
  { label: 'Failed', value: 'failed' },
  { label: 'Expired', value: 'expired' },
];

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const COLUMNS = [
  {
    header: 'Amount',
    align: 'right' as const,
    cell: (c: Charge) => <Amount value={c.amount} currency={c.currency} />,
  },
  { header: 'Status', cell: (c: Charge) => <StatusChip status={c.status} /> },
  {
    header: 'Description',
    cell: (c: Charge) => c.description ?? <span className="text-muted">—</span>,
  },
  {
    header: 'Reference',
    cell: (c: Charge) => <span className="font-mono text-[13px]">{c.reference ?? '—'}</span>,
  },
  { header: 'Created', cell: (c: Charge) => dateTime(c.createdAt) },
];

export function ChargesPage() {
  const navigate = useNavigate();
  // The filter lives in the URL, so it survives reloads and can be shared.
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as ChargeStatus | null) ?? undefined;
  const charges = useCharges(status);
  const rows = charges.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <>
      <PageHeader title="Charges">
        <p className="text-sm text-muted">
          Every charge created through the API or a payment link.
        </p>
      </PageHeader>

      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const active = filter.value === status;
          return (
            <button
              key={filter.label}
              type="button"
              aria-pressed={active}
              onClick={() => setParams(filter.value ? { status: filter.value } : {})}
              className={`rounded-full border px-3 py-1 text-sm ${
                active
                  ? 'border-accent bg-surface-accent font-semibold text-accent'
                  : 'border-line bg-surface text-ink hover:bg-bg'
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {charges.isPending ? (
        <Skeleton rows={5} label="Loading charges" />
      ) : charges.isError ? (
        <ErrorState message="Could not load charges." onRetry={() => void charges.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={status ? `No ${status} charges` : 'No charges yet'}>
          Create one with <code className="font-mono">POST /v1/charges</code> using an API key.
        </EmptyState>
      ) : (
        <>
          <DataTable
            caption="Charges"
            columns={COLUMNS}
            rows={rows}
            rowKey={(c) => c.id}
            onRowClick={(c) => void navigate(`/charges/${c.id}`)}
          />
          {charges.hasNextPage && (
            <div>
              <Button
                variant="secondary"
                loading={charges.isFetchingNextPage}
                onClick={() => void charges.fetchNextPage()}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
