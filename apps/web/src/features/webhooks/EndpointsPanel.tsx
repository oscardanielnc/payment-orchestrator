import type { CreatedWebhookEndpoint, WebhookEndpoint, WebhookEndpointList } from '@po/contracts';
import { CopyValue } from '@po/ui/data-display/CopyValue/CopyValue';
import { DataTable } from '@po/ui/data-display/DataTable/DataTable';
import { ErrorState, Skeleton } from '@po/ui/feedback/States/States';
import { TextField } from '@po/ui/forms/TextField/TextField';
import { Panel } from '@po/ui/layout/AppShell/AppShell';
import { Button } from '@po/ui/primitives/Button/Button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { api, ApiError } from '../../lib/api-client';

const date = (iso: string) => new Date(iso).toLocaleDateString([], { dateStyle: 'medium' });

/** Owner-only: endpoints hold signing secrets. */
export function EndpointsPanel() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [created, setCreated] = useState<CreatedWebhookEndpoint | null>(null);

  const endpoints = useQuery({
    queryKey: ['webhook-endpoints'],
    queryFn: () => api<WebhookEndpointList>('/webhook-endpoints'),
  });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['webhook-endpoints'] });

  const create = useMutation({
    mutationFn: () =>
      api<CreatedWebhookEndpoint>('/webhook-endpoints', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim() }),
      }),
    onSuccess: (endpoint) => {
      setCreated(endpoint);
      setUrl('');
      refresh();
    },
  });
  const disable = useMutation({
    mutationFn: (id: string) => api<void>(`/webhook-endpoints/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (url.trim()) create.mutate();
  };

  const columns = [
    {
      header: 'URL',
      cell: (e: WebhookEndpoint) => (
        <span className="font-mono text-[13px] break-all">{e.url}</span>
      ),
    },
    { header: 'Added', cell: (e: WebhookEndpoint) => date(e.createdAt) },
    {
      header: '',
      align: 'right' as const,
      cell: (e: WebhookEndpoint) =>
        e.disabledAt ? (
          <span className="text-sm text-muted">Disabled</span>
        ) : (
          <Button
            variant="danger"
            loading={disable.isPending && disable.variables === e.id}
            onClick={() => disable.mutate(e.id)}
            aria-label={`Disable ${e.url}`}
          >
            Disable
          </Button>
        ),
    },
  ];

  return (
    <Panel title="Endpoints">
      {created && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-warning bg-surface p-4"
        >
          <p className="text-sm font-semibold">
            Copy the signing secret now: it will not be shown again.
          </p>
          <CopyValue label="signing secret" value={created.secret} />
          <div>
            <Button variant="secondary" onClick={() => setCreated(null)}>
              Done
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="flex flex-wrap items-start gap-3" noValidate>
        <TextField
          label="Endpoint URL"
          type="url"
          placeholder="https://shop.example.com/webhooks"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-72 flex-1"
          hint="HTTPS. Receives charge.succeeded, charge.failed and charge.expired."
          error={
            create.error instanceof ApiError && create.error.code === 'webhook_endpoint.invalid_url'
              ? create.error.message
              : create.isError
                ? 'Could not add the endpoint'
                : undefined
          }
        />
        <Button type="submit" loading={create.isPending} disabled={!url.trim()} className="mt-6">
          Add endpoint
        </Button>
      </form>

      {endpoints.isPending ? (
        <Skeleton rows={2} label="Loading endpoints" />
      ) : endpoints.isError ? (
        <ErrorState message="Could not load endpoints." onRetry={() => void endpoints.refetch()} />
      ) : endpoints.data.data.length === 0 ? (
        <p className="text-sm text-muted">No endpoints yet.</p>
      ) : (
        <DataTable
          caption="Webhook endpoints"
          columns={columns}
          rows={endpoints.data.data}
          rowKey={(e) => e.id}
        />
      )}
    </Panel>
  );
}
