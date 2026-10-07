import type { Charge, CurrencyCode } from '@po/contracts';
import { CopyValue } from '@po/ui/data-display/CopyValue/CopyValue';
import { SelectField } from '@po/ui/forms/SelectField/SelectField';
import { TextField } from '@po/ui/forms/TextField/TextField';
import { Panel } from '@po/ui/layout/AppShell/AppShell';
import { parseMajorUnits } from '@po/ui/lib/money';
import { Button } from '@po/ui/primitives/Button/Button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { api, ApiError } from '../../lib/api-client';

const CURRENCIES: { value: CurrencyCode; label: string }[] = [
  { value: 'USD', label: 'USD · US dollar (card)' },
  { value: 'PEN', label: 'PEN · Peruvian sol (card)' },
  { value: 'USDT', label: 'USDT · TRON Nile testnet' },
  { value: 'USDC', label: 'USDC · Base Sepolia testnet' },
];

/**
 * A payment link is a charge created from the dashboard: the merchant gets its checkout URL
 * and sends it to the customer. No integration needed.
 */
export function NewPaymentLink({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [description, setDescription] = useState('');
  const [touched, setTouched] = useState(false);
  // A double submit returns the same charge instead of a second one. After an error answer
  // nothing was created, so the next try (maybe with another amount) gets a fresh key.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const minor = parseMajorUnits(amount, currency);
  const create = useMutation({
    mutationFn: () =>
      api<Charge>('/charges', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          amount: minor,
          currency,
          ...(description.trim() && { description: description.trim() }),
        }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['charges'] }),
    onError: (error) => {
      if (error instanceof ApiError) setIdempotencyKey(crypto.randomUUID());
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (minor) create.mutate();
  };

  if (create.data) {
    return (
      <Panel title="Payment link ready">
        <p className="text-sm text-muted">
          Send this link to your customer. It expires in 30 minutes.
        </p>
        <CopyValue label="payment link" value={create.data.checkoutUrl} />
        <div className="flex gap-2">
          <a
            href={create.data.checkoutUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-sm border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:bg-bg"
          >
            Open checkout
          </a>
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="New payment link">
      <form onSubmit={submit} className="flex flex-wrap items-start gap-3" noValidate>
        <TextField
          label="Amount"
          inputMode="decimal"
          placeholder="25.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={touched && !minor ? `Enter a positive amount in ${currency}` : undefined}
        />
        <SelectField
          label="Currency"
          options={CURRENCIES}
          value={currency}
          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
        />
        <TextField
          label="Description"
          placeholder="Two flat whites"
          maxLength={200}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-w-56 flex-1"
        />
        <div className="flex gap-2 self-end">
          <Button type="submit" loading={create.isPending}>
            Create link
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
        {create.isError && (
          <p role="alert" className="w-full text-sm text-danger">
            Could not create the link. Try again.
          </p>
        )}
      </form>
    </Panel>
  );
}
