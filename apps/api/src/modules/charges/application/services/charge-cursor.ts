import { InvalidChargeCursorError } from '../../domain/errors';
import type { ChargePosition } from '../ports/charge.repository';

/**
 * Opaque cursor for keyset pagination. Encodes the last item's (createdAt, id), so the
 * next page is "rows strictly after this position": stable even while new charges arrive,
 * and an index seek instead of an OFFSET scan.
 */
export const chargeCursor = {
  encode(position: ChargePosition): string {
    return Buffer.from(`${position.createdAt.toISOString()}|${position.id}`).toString('base64url');
  },

  decode(cursor: string): ChargePosition {
    const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
    const createdAt = new Date(iso ?? '');
    if (!id || Number.isNaN(createdAt.getTime())) throw new InvalidChargeCursorError();
    return { createdAt, id };
  },
};
