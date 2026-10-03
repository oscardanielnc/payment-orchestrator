import { describe, expect, it } from 'vitest';
import { InvalidWebhookSignatureError } from '../../domain/errors';
import { HmacTimestampVerifier, signHmacTimestamp } from './hmac-timestamp.verifier';

const SECRET = 'whsec_test_placeholder'; // gitleaks:allow (fake test secret)
const NOW = 1_790_900_000;
const body = JSON.stringify({ id: 'evt_1', type: 'payment.succeeded', data: { amount: '2500' } });

const verifier = new HmacTimestampVerifier('acme-psp', SECRET, {
  header: 'X-Signature',
  nowSeconds: () => NOW,
});
const verify = (raw: string, signature: string | undefined) =>
  verifier.verify(Buffer.from(raw), { 'x-signature': signature });

describe('HmacTimestampVerifier', () => {
  it('accepts a correctly signed body and extracts the event id and type', () => {
    expect(verify(body, signHmacTimestamp(SECRET, body, NOW))).toEqual({
      externalId: 'evt_1',
      type: 'payment.succeeded',
    });
  });

  it.each([
    ['a tampered body', body.replace('2500', '9999'), signHmacTimestamp(SECRET, body, NOW)],
    ['another secret', body, signHmacTimestamp('other-secret', body, NOW)],
    ['an old timestamp (replay)', body, signHmacTimestamp(SECRET, body, NOW - 301)],
    ['no header', body, undefined],
    ['a malformed header', body, 'v1=abc'],
  ])('rejects %s', (_label, raw, signature) => {
    expect(() => verify(raw, signature)).toThrow(InvalidWebhookSignatureError);
  });
});
