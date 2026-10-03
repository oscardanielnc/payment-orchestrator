import { Inject, Injectable } from '@nestjs/common';
import { UnknownWebhookProviderError } from '../../domain/errors';
import type { WebhookVerifier } from '../ports/inbound-ports';
import { InboundEventsService } from '../services/inbound-events.service';

/** DI token: verifiers of the providers configured in this environment. */
export const WEBHOOK_VERIFIERS = Symbol('WEBHOOK_VERIFIERS');

/**
 * verify signature on the raw body → store raw event once → enqueue → answer.
 * No business logic runs here: the response stays fast and the sender is never kept waiting.
 */
@Injectable()
export class ReceiveWebhookUseCase {
  private readonly verifiers: ReadonlyMap<string, WebhookVerifier>;

  constructor(
    @Inject(WEBHOOK_VERIFIERS) verifiers: WebhookVerifier[],
    private readonly inbound: InboundEventsService,
  ) {
    this.verifiers = new Map(verifiers.map((v) => [v.provider, v]));
  }

  async execute(input: {
    provider: string;
    rawBody: Buffer;
    headers: Record<string, string | undefined>;
  }): Promise<{ eventId: string; duplicate: boolean }> {
    const verifier = this.verifiers.get(input.provider);
    if (!verifier) throw new UnknownWebhookProviderError(input.provider);

    const verified = verifier.verify(input.rawBody, input.headers);
    return this.inbound.receive({
      provider: input.provider,
      externalId: verified.externalId,
      type: verified.type,
      payload: input.rawBody.toString('utf8'),
    });
  }
}
