import { describe, expect, it, vi } from 'vitest';
import { Money } from '../../../../../shared/domain/money';
import type { InboundEvent } from '../../../../inbound/domain/inbound-event';
import type { SettleProviderPaymentUseCase } from '../../../application/use-cases/settle-provider-payment.use-case';
import type { MercadoPagoApi, MercadoPagoPayment } from './mercadopago-client';
import { MercadoPagoEventHandler } from './mercadopago-event.handler';
import {
  MercadoPagoNotTestUserError,
  MercadoPagoTestUserCheck,
} from './mercadopago-test-user.check';
import { MercadoPagoProvider, paidAmount, toDecimal } from './mercadopago.provider';

const request = {
  attemptId: 'attempt-1',
  chargeId: 'charge-1',
  organizationId: 'org-1',
  method: 'mercadopago' as const,
  amount: Money.of(1500n, 'PEN'),
};

const payment = (overrides: Partial<MercadoPagoPayment> = {}): MercadoPagoPayment => ({
  id: 1001,
  status: 'approved',
  status_detail: 'accredited',
  transaction_amount: 15,
  currency_id: 'PEN',
  external_reference: 'attempt-1',
  ...overrides,
});

function fakeApi(overrides: Partial<MercadoPagoApi> = {}): MercadoPagoApi {
  return {
    createPreference: vi.fn(),
    getPayment: vi.fn(),
    searchPayments: vi.fn().mockResolvedValue({ results: [], total: 0 }),
    me: vi.fn(),
    ...overrides,
  };
}

describe('MercadoPagoProvider', () => {
  it('creates a Checkout Pro preference carrying the attempt id and redirects to it', async () => {
    const createPreference = vi.fn().mockResolvedValue({
      id: 'pref-1',
      init_point: 'https://www.mercadopago.com.pe/checkout/pref-1',
    });
    const provider = new MercadoPagoProvider(fakeApi({ createPreference }));

    const result = await provider.createPayment(request);

    expect(createPreference).toHaveBeenCalledWith(
      {
        items: [
          { id: 'charge-1', title: 'Payment', quantity: 1, unit_price: 15, currency_id: 'PEN' },
        ],
        external_reference: 'attempt-1',
        metadata: { charge_id: 'charge-1', attempt_id: 'attempt-1', organization_id: 'org-1' },
      },
      'attempt-1',
    );
    expect(result).toEqual({
      externalReference: 'attempt-1',
      instructions: { type: 'redirect', url: 'https://www.mercadopago.com.pe/checkout/pref-1' },
    });
  });

  it('reports a payment only once one is approved', async () => {
    const searchPayments = vi
      .fn()
      .mockResolvedValueOnce({ results: [payment({ status: 'rejected' })], total: 1 })
      .mockResolvedValueOnce({ results: [payment({ status: 'rejected' }), payment()], total: 2 });
    const provider = new MercadoPagoProvider(fakeApi({ searchPayments }));

    expect(await provider.fetchOutcome('attempt-1')).toBeNull();
    expect(await provider.fetchOutcome('attempt-1')).toEqual({
      kind: 'succeeded',
      amount: Money.of(1500n, 'PEN'),
    });
    expect(searchPayments).toHaveBeenCalledWith({ externalReference: 'attempt-1' });
  });

  it('converts between minor units and decimal prices without float arithmetic', () => {
    expect(toDecimal(Money.of(1500n, 'PEN'))).toBe(15);
    expect(toDecimal(Money.of(5n, 'PEN'))).toBe(0.05);
    expect(toDecimal(Money.of(1999n, 'PEN'))).toBe(19.99);
    expect(paidAmount(payment({ transaction_amount: 15.5 })).amount).toBe(1550n);
    expect(paidAmount(payment({ transaction_amount: 19.99 })).amount).toBe(1999n);
  });
});

describe('MercadoPagoEventHandler', () => {
  const notification = (body: object): InboundEvent =>
    ({ payload: JSON.stringify(body) }) as unknown as InboundEvent;

  function setup(found: MercadoPagoPayment) {
    const settle = { execute: vi.fn().mockResolvedValue('paid') };
    const getPayment = vi.fn().mockResolvedValue(found);
    const handler = new MercadoPagoEventHandler(
      fakeApi({ getPayment }),
      settle as unknown as SettleProviderPaymentUseCase,
    );
    return { handler, settle, getPayment };
  }

  it('asks Mercado Pago for the payment before settling it', async () => {
    const { handler, settle, getPayment } = setup(payment());

    await handler.handle(
      notification({ type: 'payment', action: 'payment.updated', data: { id: '1001' } }),
    );

    expect(getPayment).toHaveBeenCalledWith('1001');
    expect(settle.execute).toHaveBeenCalledWith({
      provider: 'mercadopago',
      externalReference: 'attempt-1',
      outcome: { kind: 'succeeded', amount: Money.of(1500n, 'PEN') },
    });
  });

  it('turns a rejection into a decline the customer can retry', async () => {
    const { handler, settle } = setup(
      payment({ status: 'rejected', status_detail: 'cc_rejected_other_reason' }),
    );

    await handler.handle(notification({ type: 'payment', data: { id: 1001 } }));

    expect(settle.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: { kind: 'declined', reason: 'cc_rejected_other_reason' },
      }),
    );
  });

  it('ignores pending payments and other topics', async () => {
    const pending = setup(payment({ status: 'in_process' }));
    await pending.handler.handle(notification({ type: 'payment', data: { id: 1001 } }));
    expect(pending.settle.execute).not.toHaveBeenCalled();

    const other = setup(payment());
    await other.handler.handle(notification({ type: 'merchant_order', data: { id: 7 } }));
    expect(other.getPayment).not.toHaveBeenCalled();
  });
});

describe('MercadoPagoTestUserCheck', () => {
  it('lets the app start only with a test user token', async () => {
    const ok = new MercadoPagoTestUserCheck(
      fakeApi({
        me: vi.fn().mockResolvedValue({ id: 1, site_id: 'MPE', tags: ['normal', 'test_user'] }),
      }),
    );
    await expect(ok.onModuleInit()).resolves.toBeUndefined();

    const real = new MercadoPagoTestUserCheck(
      fakeApi({ me: vi.fn().mockResolvedValue({ id: 2, site_id: 'MPE', tags: ['normal'] }) }),
    );
    await expect(real.onModuleInit()).rejects.toThrow(MercadoPagoNotTestUserError);
  });

  it('fails closed when Mercado Pago cannot be asked', async () => {
    const offline = new MercadoPagoTestUserCheck(
      fakeApi({ me: vi.fn().mockRejectedValue(new Error('timeout')) }),
    );
    await expect(offline.onModuleInit()).rejects.toThrow(/could not verify/);
  });
});
