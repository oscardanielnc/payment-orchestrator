import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { InvalidWebhookSignatureError } from '../../domain/errors';
import { MercadoPagoWebhookVerifier } from './mercadopago-webhook.verifier';

const SECRET = 'test-webhook-secret'; // gitleaks:allow (fixture, not a credential)
const verifier = new MercadoPagoWebhookVerifier(SECRET);

const notification = {
  id: 12345678901,
  live_mode: false,
  type: 'payment',
  action: 'payment.updated',
  data: { id: '1001' },
};

function signed(body: object, requestId = 'req-1', ts = '1792111200') {
  const manifest = `id:1001;request-id:${requestId};ts:${ts};`;
  const v1 = createHmac('sha256', SECRET).update(manifest).digest('hex');
  return {
    raw: Buffer.from(JSON.stringify(body)),
    headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId },
  };
}

describe('MercadoPagoWebhookVerifier', () => {
  it('accepts a correctly signed notification and keys it by its notification id', () => {
    const { raw, headers } = signed(notification);

    expect(verifier.verify(raw, headers)).toEqual({
      externalId: '12345678901',
      type: 'payment.updated',
    });
  });

  it('rejects a notification about another payment than the one signed', () => {
    const { headers } = signed(notification);
    const tampered = Buffer.from(JSON.stringify({ ...notification, data: { id: '9999' } }));

    expect(() => verifier.verify(tampered, headers)).toThrow(InvalidWebhookSignatureError);
  });

  it('rejects a missing or malformed signature', () => {
    const raw = Buffer.from(JSON.stringify(notification));
    expect(() => verifier.verify(raw, {})).toThrow('missing x-signature');
    expect(() => verifier.verify(raw, { 'x-signature': 'v1=abc' })).toThrow('malformed');
    expect(() =>
      verifier.verify(raw, { 'x-signature': 'ts=1,v1=00', 'x-request-id': 'req-1' }),
    ).toThrow('does not match');
  });

  it('accepts notifications marked live_mode, as Mercado Pago marks test users payments', () => {
    const { raw, headers } = signed({ ...notification, live_mode: true });

    expect(verifier.verify(raw, headers).externalId).toBe('12345678901');
  });
});
