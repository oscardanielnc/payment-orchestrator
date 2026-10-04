import type { Meta, StoryObj } from '@storybook/react-vite';
import { Amount } from './Amount/Amount';
import { DataTable } from './DataTable/DataTable';
import { PaymentRail } from './PaymentRail/PaymentRail';
import { type ChargeStatus, StatusChip } from './StatusChip/StatusChip';

const meta = { title: 'Data display' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Amounts: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Amount value="10000000" currency="USDT" size="hero" />
      <Amount value="250000" currency="USD" />
      <Amount value="1234567" currency="USDC" />
      <Amount value="999999999999999999" currency="PEN" />
    </div>
  ),
};

export const StatusChips: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(['pending', 'processing', 'succeeded', 'failed', 'expired'] as ChargeStatus[]).map((s) => (
        <StatusChip key={s} status={s} />
      ))}
    </div>
  ),
};

export const RailWaitingForPayment: Story = {
  render: () => (
    <PaymentRail
      stations={[
        { label: 'Created', detail: '08:14', state: 'done' },
        { label: 'Routed', detail: 'USDT · TRON', state: 'done' },
        { label: 'Paid', detail: 'Waiting for the transfer', state: 'current' },
        { label: 'Posted', detail: 'Ledger', state: 'upcoming' },
      ]}
    />
  ),
};

export const RailPosted: Story = {
  render: () => (
    <PaymentRail
      stations={[
        { label: 'Created', state: 'done' },
        { label: 'Routed', detail: 'Card · Stripe', state: 'done' },
        { label: 'Paid', state: 'done' },
        { label: 'Posted', detail: 'Ledger', state: 'done' },
      ]}
    />
  ),
};

export const RailFailed: Story = {
  render: () => (
    <PaymentRail
      stations={[
        { label: 'Created', state: 'done' },
        { label: 'Routed', state: 'done' },
        { label: 'Failed', detail: 'Payment canceled', state: 'failed' },
      ]}
    />
  ),
};

const rows = [
  {
    id: 'ch_1',
    reference: 'order-4821',
    amount: '10000000',
    currency: 'USDT',
    status: 'succeeded' as const,
  },
  {
    id: 'ch_2',
    reference: 'order-4822',
    amount: '2500',
    currency: 'USD',
    status: 'processing' as const,
  },
  {
    id: 'ch_3',
    reference: 'an-unusually-long-merchant-reference-that-must-wrap-or-scroll',
    amount: '999999999999',
    currency: 'PEN',
    status: 'expired' as const,
  },
];

export const Table: Story = {
  render: () => (
    <DataTable
      caption="Charges"
      rows={rows}
      rowKey={(r) => r.id}
      onRowClick={() => {}}
      columns={[
        { header: 'Reference', cell: (r) => r.reference },
        { header: 'Status', cell: (r) => <StatusChip status={r.status} /> },
        {
          header: 'Amount',
          align: 'right',
          cell: (r) => <Amount value={r.amount} currency={r.currency} />,
        },
      ]}
    />
  ),
};
