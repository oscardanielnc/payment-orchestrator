import { describe, expect, it, vi } from 'vitest';
import type { LedgerService } from '../../../ledger/application/services/ledger.service';
import type {
  MercadoPagoApi,
  MercadoPagoPayment,
} from '../../../payments/infrastructure/providers/mercadopago/mercadopago-client';
import { MercadoPagoReconciliationSource } from './mercadopago-reconciliation.source';

const payment = (overrides: Partial<MercadoPagoPayment>): MercadoPagoPayment => ({
  id: 1,
  status: 'approved',
  transaction_amount: 15,
  currency_id: 'PEN',
  external_reference: 'attempt-1',
  metadata: { organization_id: 'org-1', charge_id: 'charge-1' },
  ...overrides,
});

describe('MercadoPagoReconciliationSource', () => {
  it('sums approved payments per attempt and ignores the rest', async () => {
    const results = [
      payment({ id: 1 }),
      payment({ id: 2, transaction_amount: 15 }), // paid twice on one preference
      payment({ id: 3, status: 'rejected', external_reference: 'attempt-2' }),
      payment({ id: 4, external_reference: null }), // not created by us
    ];
    const api: MercadoPagoApi = {
      createPreference: vi.fn(),
      getPayment: vi.fn(),
      me: vi.fn(),
      searchPayments: vi.fn().mockResolvedValue({ results, total: results.length }),
    };
    const source = new MercadoPagoReconciliationSource(api, {} as LedgerService);

    const records = await source.providerRecordsIn({
      from: new Date('2026-10-21T00:00:00Z'),
      to: new Date('2026-10-22T00:00:00Z'),
    });

    expect(records).toEqual([
      {
        subject: 'provider-payment:mercadopago:attempt-1',
        organizationId: 'org-1',
        chargeId: 'charge-1',
        currency: 'PEN',
        amount: 3000n,
      },
    ]);
  });
});
