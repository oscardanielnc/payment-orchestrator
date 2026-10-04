import type { ApiKeyList, ApiKeySummary, CreatedApiKey } from '@po/contracts';
import { DataTable } from '@po/ui/data-display/DataTable/DataTable';
import { ErrorState, Skeleton } from '@po/ui/feedback/States/States';
import { TextField } from '@po/ui/forms/TextField/TextField';
import { PageHeader, Panel } from '@po/ui/layout/AppShell/AppShell';
import { Button } from '@po/ui/primitives/Button/Button';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { api } from '../../lib/api-client';
import { useSession } from '../../lib/session-store';

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString([], { dateStyle: 'medium' }) : '—';

export function ApiKeysPage() {
  const queryClient = useQueryClient();
  const isOwner = useSession((s) => s.user?.role === 'owner');
  const [name, setName] = useState('');
  const [created, setCreated] = useState<CreatedApiKey | null>(null);

  const keys = useQuery({ queryKey: ['api-keys'], queryFn: () => api<ApiKeyList>('/api-keys') });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['api-keys'] });

  const create = useMutation({
    mutationFn: () =>
      api<CreatedApiKey>('/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name }),
        // A double click must not mint two keys.
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      }),
    onSuccess: (key) => {
      setCreated(key);
      setName('');
      void refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api<void>(`/api-keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => void refresh(),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) create.mutate();
  };

  const columns = [
    { header: 'Name', cell: (k: ApiKeySummary) => k.name },
    {
      header: 'Key',
      cell: (k: ApiKeySummary) => <span className="font-mono text-[13px]">{k.prefix}…</span>,
    },
    { header: 'Created', cell: (k: ApiKeySummary) => date(k.createdAt) },
    { header: 'Last used', cell: (k: ApiKeySummary) => date(k.lastUsedAt) },
    {
      header: '',
      align: 'right' as const,
      cell: (k: ApiKeySummary) =>
        k.revokedAt ? (
          <span className="text-sm text-muted">Revoked</span>
        ) : isOwner ? (
          <Button
            variant="danger"
            loading={revoke.isPending && revoke.variables === k.id}
            onClick={() => revoke.mutate(k.id)}
            aria-label={`Revoke ${k.name}`}
          >
            Revoke
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader title="API keys">
        <p className="text-sm text-muted">
          Server-to-server credentials. Only a hash of each key is stored.
        </p>
      </PageHeader>

      {created && (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-warning bg-surface p-4"
        >
          <p className="text-sm font-semibold">
            Copy “{created.name}” now: it will not be shown again.
          </p>
          <code className="font-mono text-[13px] break-all">{created.token}</code>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => void navigator.clipboard.writeText(created.token)}
            >
              Copy
            </Button>
            <Button variant="secondary" onClick={() => setCreated(null)}>
              Done
            </Button>
          </div>
        </div>
      )}

      {isOwner && (
        <Panel title="Create a key">
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <TextField
              label="Name"
              placeholder="e.g. Production server"
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              error={create.isError ? 'Could not create the key' : undefined}
            />
            <Button type="submit" loading={create.isPending} disabled={!name.trim()}>
              Create key
            </Button>
          </form>
        </Panel>
      )}

      {keys.isPending ? (
        <Skeleton rows={3} label="Loading API keys" />
      ) : keys.isError ? (
        <ErrorState message="Could not load API keys." onRetry={() => void keys.refetch()} />
      ) : (
        <DataTable
          caption="API keys"
          columns={columns}
          rows={keys.data.data}
          rowKey={(k) => k.id}
        />
      )}
    </>
  );
}
