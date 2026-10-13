import { Injectable } from '@nestjs/common';
import { InvalidFindingCursorError } from '../../domain/errors';
import type { Finding, FindingStatus } from '../../domain/finding';
import { type FindingPosition, FindingRepository } from '../ports/reconciliation-ports';

/** Opaque keyset cursor over (firstSeenAt desc, id desc): stable while runs update rows. */
const cursor = {
  encode: (p: FindingPosition) =>
    Buffer.from(`${p.firstSeenAt.toISOString()}|${p.id}`).toString('base64url'),
  decode(value: string): FindingPosition {
    const [iso, id] = Buffer.from(value, 'base64url').toString('utf8').split('|');
    const firstSeenAt = new Date(iso ?? '');
    if (!id || Number.isNaN(firstSeenAt.getTime())) throw new InvalidFindingCursorError();
    return { firstSeenAt, id };
  },
};

/** A merchant sees the findings about its own charges; platform-wide ones stay internal. */
@Injectable()
export class ListFindingsUseCase {
  constructor(private readonly findings: FindingRepository) {}

  async execute(input: {
    organizationId: string;
    status?: FindingStatus;
    limit: number;
    cursor?: string;
  }): Promise<{ items: Finding[]; nextCursor: string | null }> {
    const page = await this.findings.listForOrganization({
      organizationId: input.organizationId,
      status: input.status,
      limit: input.limit,
      after: input.cursor ? cursor.decode(input.cursor) : null,
    });
    return { items: page.items, nextCursor: page.next ? cursor.encode(page.next) : null };
  }
}
