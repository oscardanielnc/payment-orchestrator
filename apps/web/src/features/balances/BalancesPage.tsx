import type { Balance, BalanceList } from '@po/contracts';
import { Amount } from '@po/ui/data-display/Amount/Amount';
import { DataTable } from '@po/ui/data-display/DataTable/DataTable';
import { EmptyState, ErrorState, Skeleton } from '@po/ui/feedback/States/States';
import { PageHeader } from '@po/ui/layout/AppShell/AppShell';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';

const COLUMNS = [
  { header: 'Account', cell: (b: Balance) => b.name },
  { header: 'Currency', cell: (b: Balance) => b.currency },
  {
    header: 'Posted',
    align: 'right' as const,
    cell: (b: Balance) => <Amount value={b.posted} currency={b.currency} />,
  },
  {
    header: 'Including pending',
    align: 'right' as const,
    cell: (b: Balance) => <Amount value={b.pending} currency={b.currency} />,
  },
];

export function BalancesPage() {
  const balances = useQuery({
    queryKey: ['balances'],
    queryFn: () => api<BalanceList>('/balances'),
  });

  return (
    <>
      <PageHeader title="Balances">
        <p className="text-sm text-muted">
          Read from the double-entry ledger, one row per account and currency.
        </p>
      </PageHeader>
      {balances.isPending ? (
        <Skeleton rows={3} label="Loading balances" />
      ) : balances.isError ? (
        <ErrorState message="Could not load balances." onRetry={() => void balances.refetch()} />
      ) : balances.data.data.length === 0 ? (
        <EmptyState title="No balances yet">
          They appear after the first payment settles.
        </EmptyState>
      ) : (
        <DataTable
          caption="Balances"
          columns={COLUMNS}
          rows={balances.data.data}
          rowKey={(b) => b.account}
        />
      )}
    </>
  );
}
