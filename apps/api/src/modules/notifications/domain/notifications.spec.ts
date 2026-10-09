import { describe, expect, it } from 'vitest';
import { InvalidWebhookUrlError } from './errors';
import { WebhookDelivery } from './webhook-delivery';
import { validateWebhookUrl } from './webhook-endpoint';

const NOW = new Date('2026-10-09T12:00:00Z');

describe('validateWebhookUrl', () => {
  it.each(['https://shop.example.com/hooks', 'https://api.shop.example.com:8443/po'])(
    'accepts %s',
    (url) => {
      expect(validateWebhookUrl(url, false)).toBe(url);
    },
  );

  it.each([
    ['http://shop.example.com/hooks', 'plain http'],
    ['https://user:pass@shop.example.com', 'credentials'],
    ['https://10.0.0.5/hooks', 'private network'],
    ['https://192.168.1.10/hooks', 'private network'],
    ['https://169.254.169.254/latest/meta-data', 'cloud metadata service'],
    ['https://[::1]/hooks', 'IPv6 literal'],
    ['http://localhost:4000/hooks', 'localhost outside development'],
    ['not a url', 'garbage'],
  ])('rejects %s (%s)', (url) => {
    expect(() => validateWebhookUrl(url, false)).toThrow(InvalidWebhookUrlError);
  });

  it('allows http://localhost only when local development is allowed', () => {
    expect(validateWebhookUrl('http://localhost:4000/hooks', true)).toBe(
      'http://localhost:4000/hooks',
    );
  });
});

describe('WebhookDelivery', () => {
  const delivery = () =>
    WebhookDelivery.create({
      id: 'd1',
      organizationId: 'org-1',
      endpointId: 'e1',
      eventId: 'evt-1',
      eventType: 'charge.succeeded',
      payload: '{}',
      now: NOW,
    });
  const attempt = (statusCode: number | null) => ({
    attemptedAt: NOW,
    statusCode,
    error: statusCode === 200 ? null : 'HTTP 500',
    durationMs: 12,
  });

  it('is delivered by a 2xx', () => {
    const d = delivery();
    d.recordAttempt(attempt(200), false);

    expect([d.status, d.attemptCount, d.deliveredAt]).toEqual(['succeeded', 1, NOW]);
  });

  it('stays pending after a failure until the last allowed attempt', () => {
    const d = delivery();
    d.recordAttempt(attempt(500), false);
    d.recordAttempt(attempt(null), false);
    expect(d.status).toBe('pending');

    d.recordAttempt(attempt(503), true);
    expect([d.status, d.attemptCount, d.lastStatusCode]).toEqual(['failed', 3, 503]);
    expect(d.pullNewAttempts()).toHaveLength(3);
  });

  it('ignores attempts once finished (duplicate jobs)', () => {
    const d = delivery();
    d.recordAttempt(attempt(200), false);
    d.recordAttempt(attempt(500), true);

    expect([d.status, d.attemptCount]).toEqual(['succeeded', 1]);
  });
});
