import { Injectable } from '@nestjs/common';
import type { Charge } from '../../domain/charge';
import { ChargeRepository } from '../ports/charge.repository';
import { chargeCursor } from '../services/charge-cursor';

@Injectable()
export class ListChargesUseCase {
  constructor(private readonly charges: ChargeRepository) {}

  async execute(input: {
    organizationId: string;
    limit: number;
    cursor?: string;
  }): Promise<{ items: Charge[]; nextCursor: string | null }> {
    const page = await this.charges.listForOrganization(input.organizationId, {
      limit: input.limit,
      after: input.cursor ? chargeCursor.decode(input.cursor) : null,
    });
    return {
      items: page.items,
      nextCursor: page.next ? chargeCursor.encode(page.next) : null,
    };
  }
}
