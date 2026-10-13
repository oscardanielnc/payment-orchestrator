import type {
  ReconciliationFinding,
  ReconciliationFindingKind,
  ReconciliationFindingList,
  ReconciliationFindingStatus,
} from '@po/contracts';
import { Amount } from '@po/ui/data-display/Amount/Amount';
import { DataTable } from '@po/ui/data-display/DataTable/DataTable';
import { EmptyState, ErrorState, Skeleton } from '@po/ui/feedback/States/States';
import { FilterPills } from '@po/ui/forms/FilterPills/FilterPills';
import { PageHeader } from '@po/ui/layout/AppShell/AppShell';
import { Button } from '@po/ui/primitives/Button/Button';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router';
import { api } from '../../lib/api-client';
import { useSession } from '../../lib/session-store';

const FILTERS: { label: string; value?: ReconciliationFindingStatus }[] = [
  { label: 'All' },
  { label: 'Open', value: 'open' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Cleared', value: 'cleared' },
];

/** What each kind means for the merchant, in plain words. */
const KIND: Record<ReconciliationFindingKind, string> = {
  missing_in_ledger: 'Paid at provider, not recorded',
  missing_at_provider: 'Recorded, not found at provider',
  amount_mismatch: 'Amounts differ',
};

const SOURCE: Record<string, string> = {
  stripe: 'Stripe',
  'tron-nile': 'TRON Nile',
  'base-sepolia': 'Base Sepolia',
};

/** Shape + color, like StatusChip: readable without color. */
const STATUS: Record<ReconciliationFindingStatus, { label: string; symbol: string; tone: string }> =
  {
    open: { label: 'Open', symbol: '◐', tone: 'text-warning' },
    resolved: { label: 'Resolved', symbol: '●', tone: 'text-success' },
    cleared: { label: 'Cleared', symbol: '○', tone: 'text-muted' },
  };

const day = (iso: string) =>
  new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });

function useFindings(status: ReconciliationFindingStatus | undefined) {
  return useInfiniteQuery({
    queryKey: ['reconciliation-findings', status ?? 'all'],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (status) params.set('status', status);
      if (pageParam) params.set('cursor', pageParam);
      return api<ReconciliationFindingList>(`/reconciliation/findings?${params.toString()}`);
    },
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

function ResolveButton({ finding }: { finding: ReconciliationFinding }) {
  const queryClient = useQueryClient();
  const resolve = useMutation({
    mutationFn: () =>
      api<ReconciliationFinding>(`/reconciliation/findings/${finding.id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reconciliation-findings'] }),
  });
  return (
    <Button variant="secondary" loading={resolve.isPending} onClick={() => resolve.mutate()}>
      Mark resolved
    </Button>
  );
}

export function ReconciliationPage() {
  const isOwner = useSession((s) => s.user?.role === 'owner');
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as ReconciliationFindingStatus | null) ?? undefined;
  const findings = useFindings(status);
  const rows = findings.data?.pages.flatMap((p) => p.data) ?? [];

  const columns = [
    {
      header: 'Difference',
      cell: (f: ReconciliationFinding) => <span className="font-semibold">{KIND[f.kind]}</span>,
    },
    { header: 'Source', cell: (f: ReconciliationFinding) => SOURCE[f.source] ?? f.source },
    {
      header: 'Provider',
      align: 'right' as const,
      cell: (f: ReconciliationFinding) => <Amount value={f.providerAmount} currency={f.currency} />,
    },
    {
      header: 'Ledger',
      align: 'right' as const,
      cell: (f: ReconciliationFinding) => <Amount value={f.ledgerAmount} currency={f.currency} />,
    },
    {
      header: 'Status',
      cell: (f: ReconciliationFinding) => {
        const s = STATUS[f.status];
        return (
          <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${s.tone}`}>
            <span aria-hidden>{s.symbol}</span>
            {s.label}
          </span>
        );
      },
    },
    {
      header: 'Charge',
      cell: (f: ReconciliationFinding) =>
        f.chargeId ? (
          <Link className="text-accent underline" to={`/charges/${f.chargeId}`}>
            View
          </Link>
        ) : (
          '—'
        ),
    },
    { header: 'Seen', cell: (f: ReconciliationFinding) => day(f.firstSeenAt) },
    ...(isOwner
      ? [
          {
            header: 'Action',
            cell: (f: ReconciliationFinding) =>
              f.status === 'open' ? <ResolveButton finding={f} /> : (f.note ?? '—'),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader title="Reconciliation">
        <p className="text-sm text-muted">
          Daily comparison of what providers report against your ledger. Nothing here changes money:
          an owner looks and decides.
        </p>
      </PageHeader>

      <FilterPills
        label="Filter by status"
        options={FILTERS}
        value={status}
        onChange={(value) => setParams(value ? { status: value } : {})}
      />

      {findings.isPending ? (
        <Skeleton rows={4} label="Loading findings" />
      ) : findings.isError ? (
        <ErrorState message="Could not load findings." onRetry={() => void findings.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title={status ? `No ${status} findings` : 'Everything matches'}>
          Each day is compared after it ends (UTC). Differences show up here.
        </EmptyState>
      ) : (
        <>
          <DataTable
            caption="Reconciliation findings"
            columns={columns}
            rows={rows}
            rowKey={(f) => f.id}
          />
          {findings.hasNextPage && (
            <div>
              <Button
                variant="secondary"
                loading={findings.isFetchingNextPage}
                onClick={() => void findings.fetchNextPage()}
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
