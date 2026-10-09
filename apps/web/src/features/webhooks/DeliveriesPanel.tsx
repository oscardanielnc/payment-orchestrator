import type {
  WebhookDelivery,
  WebhookDeliveryAttempt,
  WebhookDeliveryDetail,
  WebhookDeliveryList,
  WebhookDeliveryStatus,
} from '@po/contracts';
import { DataTable } from '@po/ui/data-display/DataTable/DataTable';
import { EmptyState, ErrorState, Skeleton } from '@po/ui/feedback/States/States';
import { Panel } from '@po/ui/layout/AppShell/AppShell';
import { Button } from '@po/ui/primitives/Button/Button';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api-client';

const time = (iso: string) =>
  new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

/** Shape + color, like StatusChip: readable without color. */
const STATUS: Record<WebhookDeliveryStatus, { label: string; symbol: string; tone: string }> = {
  pending: { label: 'Retrying', symbol: '◐', tone: 'text-warning' },
  succeeded: { label: 'Delivered', symbol: '●', tone: 'text-success' },
  failed: { label: 'Failed', symbol: '✕', tone: 'text-danger' },
};

function DeliveryStatus({ status }: { status: WebhookDeliveryStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${s.tone}`}>
      <span aria-hidden>{s.symbol}</span>
      {s.label}
    </span>
  );
}

const COLUMNS = [
  {
    header: 'Event',
    cell: (d: WebhookDelivery) => <span className="font-mono text-[13px]">{d.eventType}</span>,
  },
  { header: 'Status', cell: (d: WebhookDelivery) => <DeliveryStatus status={d.status} /> },
  { header: 'Attempts', align: 'right' as const, cell: (d: WebhookDelivery) => d.attemptCount },
  { header: 'Last response', cell: (d: WebhookDelivery) => d.lastStatusCode ?? d.lastError ?? '—' },
  { header: 'Created', cell: (d: WebhookDelivery) => time(d.createdAt) },
];

const ATTEMPT_COLUMNS = [
  { header: 'When', cell: (a: WebhookDeliveryAttempt) => time(a.attemptedAt) },
  { header: 'Response', cell: (a: WebhookDeliveryAttempt) => a.statusCode ?? 'No response' },
  { header: 'Error', cell: (a: WebhookDeliveryAttempt) => a.error ?? '—' },
  {
    header: 'Duration',
    align: 'right' as const,
    cell: (a: WebhookDeliveryAttempt) => `${a.durationMs} ms`,
  },
];

/** Delivery log; refreshes while something is still retrying. */
export function DeliveriesPanel() {
  const [selected, setSelected] = useState<string | null>(null);
  const deliveries = useInfiniteQuery({
    queryKey: ['webhook-deliveries'],
    queryFn: ({ pageParam }) =>
      api<WebhookDeliveryList>(
        `/webhook-deliveries?limit=20${pageParam ? `&cursor=${pageParam}` : ''}`,
      ),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: (query) =>
      query.state.data?.pages.some((p) => p.data.some((d) => d.status === 'pending'))
        ? 5000
        : false,
  });
  const rows = deliveries.data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <Panel title="Deliveries">
      {deliveries.isPending ? (
        <Skeleton rows={4} label="Loading deliveries" />
      ) : deliveries.isError ? (
        <ErrorState
          message="Could not load deliveries."
          onRetry={() => void deliveries.refetch()}
        />
      ) : rows.length === 0 ? (
        <EmptyState title="No deliveries yet">
          They appear when a charge succeeds, fails or expires.
        </EmptyState>
      ) : (
        <>
          <DataTable
            caption="Webhook deliveries"
            columns={COLUMNS}
            rows={rows}
            rowKey={(d) => d.id}
            onRowClick={(d) => setSelected(d.id === selected ? null : d.id)}
          />
          {deliveries.hasNextPage && (
            <div>
              <Button
                variant="secondary"
                loading={deliveries.isFetchingNextPage}
                onClick={() => void deliveries.fetchNextPage()}
              >
                Load more
              </Button>
            </div>
          )}
        </>
      )}
      {selected && <DeliveryDetail id={selected} />}
    </Panel>
  );
}

function DeliveryDetail({ id }: { id: string }) {
  const detail = useQuery({
    queryKey: ['webhook-delivery', id],
    queryFn: () => api<WebhookDeliveryDetail>(`/webhook-deliveries/${id}`),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 5000 : false),
  });

  if (detail.isPending) return <Skeleton rows={2} label="Loading delivery" />;
  if (detail.isError) return <ErrorState message="Could not load this delivery." />;

  const d = detail.data;
  return (
    <section aria-label="Delivery detail" className="flex flex-col gap-3 border-t border-line pt-4">
      <p className="text-sm">
        <span className="text-muted">Event id </span>
        <span className="font-mono text-[13px]">{d.eventId}</span>
      </p>
      {d.attempts.length === 0 ? (
        <p className="text-sm text-muted">Not attempted yet.</p>
      ) : (
        <DataTable
          caption="Delivery attempts"
          columns={ATTEMPT_COLUMNS}
          rows={d.attempts}
          rowKey={(a) => a.attemptedAt}
        />
      )}
      <pre className="overflow-x-auto rounded-sm border border-line bg-bg p-3 font-mono text-[12px]">
        {JSON.stringify(JSON.parse(d.payload), null, 2)}
      </pre>
    </section>
  );
}
