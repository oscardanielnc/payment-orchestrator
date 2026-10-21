import { createHmac, timingSafeEqual } from 'node:crypto';
import { WebhookVerifier } from '../../application/ports/inbound-ports';
import { InvalidWebhookSignatureError } from '../../domain/errors';
import type { VerifiedEvent } from '../../domain/inbound-event';

interface Notification {
  id?: string | number;
  type?: string;
  action?: string;
  data?: { id?: string | number };
}

/**
 * Mercado Pago's `x-signature: ts=…,v1=…`: HMAC-SHA256 with the application's secret over the
 * manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` (parts whose value is missing are
 * left out, and an alphanumeric data.id is lowercased, per Mercado Pago's docs).
 * `live_mode` is not checked: Mercado Pago marks test users' payments `live_mode: true` too
 * (seen 2026-10-21). "Never live" is enforced at boot, where the token must be a test user's.
 */
export class MercadoPagoWebhookVerifier extends WebhookVerifier {
  readonly provider = 'mercadopago';

  constructor(private readonly secret: string) {
    super();
  }

  verify(rawBody: Buffer, headers: Record<string, string | undefined>): VerifiedEvent {
    const header = headers['x-signature'];
    if (!header) throw new InvalidWebhookSignatureError('missing x-signature header');
    const parts: Record<string, string | undefined> = Object.fromEntries(
      header.split(',').map((part): [string, string] => {
        const [key = '', ...value] = part.trim().split('=');
        return [key, value.join('=')];
      }),
    );
    if (!parts.ts || !parts.v1) throw new InvalidWebhookSignatureError('malformed x-signature');

    let body: Notification;
    try {
      body = JSON.parse(rawBody.toString('utf8')) as Notification;
    } catch {
      throw new InvalidWebhookSignatureError('body is not JSON');
    }

    const dataId = body.data?.id === undefined ? undefined : String(body.data.id).toLowerCase();
    const manifest =
      (dataId ? `id:${dataId};` : '') +
      (headers['x-request-id'] ? `request-id:${headers['x-request-id']};` : '') +
      `ts:${parts.ts};`;
    const expected = createHmac('sha256', this.secret).update(manifest).digest();
    const received = Buffer.from(parts.v1, 'hex');
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new InvalidWebhookSignatureError('x-signature does not match');
    }

    return {
      // One notification → one inbound event; a repeated delivery carries the same id.
      externalId: String(body.id ?? `${body.type}:${dataId}:${body.action}`),
      type: body.action ?? body.type ?? 'unknown',
    };
  }
}
