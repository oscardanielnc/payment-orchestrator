import { createHmac, timingSafeEqual } from 'node:crypto';
import { WebhookVerifier } from '../../application/ports/inbound-ports';
import { InvalidWebhookSignatureError } from '../../domain/errors';
import type { VerifiedEvent } from '../../domain/inbound-event';

const DEFAULT_TOLERANCE_SECONDS = 300;

/**
 * Signature header `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`, the scheme
 * Stripe uses. The timestamp is inside the signed bytes, so an old request replayed later
 * fails the tolerance check even though its signature is genuine.
 */
export function signHmacTimestamp(secret: string, rawBody: string, timestamp: number): string {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

export class HmacTimestampVerifier extends WebhookVerifier {
  constructor(
    readonly provider: string,
    private readonly secret: string,
    private readonly options: {
      header: string;
      toleranceSeconds?: number;
      nowSeconds?: () => number;
    },
  ) {
    super();
  }

  verify(rawBody: Buffer, headers: Record<string, string | undefined>): VerifiedEvent {
    const header = headers[this.options.header.toLowerCase()];
    if (!header) throw new InvalidWebhookSignatureError('missing signature header');

    const parts = new Map(
      header.split(',').map((part) => part.split('=', 2) as [string, string | undefined]),
    );
    const timestamp = Number(parts.get('t'));
    const signature = parts.get('v1');
    if (!Number.isInteger(timestamp) || !signature) {
      throw new InvalidWebhookSignatureError('malformed signature header');
    }

    const now = (this.options.nowSeconds ?? (() => Math.floor(Date.now() / 1000)))();
    if (Math.abs(now - timestamp) > (this.options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS)) {
      throw new InvalidWebhookSignatureError('timestamp outside the tolerance window');
    }

    const expected = createHmac('sha256', this.secret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest();
    const given = Buffer.from(signature, 'hex');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new InvalidWebhookSignatureError('signature does not match');
    }

    const body = JSON.parse(rawBody.toString('utf8')) as { id?: unknown; type?: unknown };
    if (typeof body.id !== 'string' || typeof body.type !== 'string') {
      throw new InvalidWebhookSignatureError('signed body has no event id or type');
    }
    return { externalId: body.id, type: body.type };
  }
}
