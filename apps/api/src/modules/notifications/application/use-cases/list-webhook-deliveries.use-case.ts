import { Injectable } from '@nestjs/common';
import { InvalidWebhookCursorError } from '../../domain/errors';
import type { WebhookDelivery } from '../../domain/webhook-delivery';
import { type DeliveryPosition, WebhookDeliveryRepository } from '../ports/notification-ports';

/** Opaque keyset cursor over (createdAt desc, id desc), like the charges list. */
const cursor = {
  encode: (p: DeliveryPosition) =>
    Buffer.from(`${p.createdAt.toISOString()}|${p.id}`).toString('base64url'),
  decode(value: string): DeliveryPosition {
    const [iso, id] = Buffer.from(value, 'base64url').toString('utf8').split('|');
    const createdAt = new Date(iso ?? '');
    if (!id || Number.isNaN(createdAt.getTime())) throw new InvalidWebhookCursorError();
    return { createdAt, id };
  },
};

@Injectable()
export class ListWebhookDeliveriesUseCase {
  constructor(private readonly deliveries: WebhookDeliveryRepository) {}

  async execute(input: {
    organizationId: string;
    limit: number;
    cursor?: string;
  }): Promise<{ items: WebhookDelivery[]; nextCursor: string | null }> {
    const page = await this.deliveries.listForOrganization(input.organizationId, {
      limit: input.limit,
      after: input.cursor ? cursor.decode(input.cursor) : null,
    });
    return { items: page.items, nextCursor: page.next ? cursor.encode(page.next) : null };
  }
}
