import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Amount } from './Amount/Amount';
import { DataTable } from './DataTable/DataTable';
import { PaymentRail } from './PaymentRail/PaymentRail';
import { StatusChip } from './StatusChip/StatusChip';

describe('data display', () => {
  it('Amount shows 10000000 USDT minor units as 10.00 USDT', () => {
    render(<Amount value="10000000" currency="USDT" />);

    expect(screen.getByText('10.00')).toBeInTheDocument();
    expect(screen.getByText('USDT')).toBeInTheDocument();
  });

  it('StatusChip carries its meaning in text, not only color', () => {
    render(<StatusChip status="failed" />);

    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('PaymentRail marks the current station for assistive tech', () => {
    render(
      <PaymentRail
        stations={[
          { label: 'Created', state: 'done' },
          { label: 'Routed', state: 'current' },
          { label: 'Paid', state: 'upcoming' },
        ]}
      />,
    );

    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Routed');
  });

  it('DataTable rows open with the keyboard', async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable
        caption="Charges"
        columns={[{ header: 'Reference', cell: (row: { id: string }) => row.id }]}
        rows={[{ id: 'order-4821' }]}
        rowKey={(row) => row.id}
        onRowClick={onRowClick}
      />,
    );

    screen.getByText('order-4821').closest('tr')?.focus();
    await userEvent.keyboard('{Enter}');

    expect(onRowClick).toHaveBeenCalledWith({ id: 'order-4821' });
  });
});
