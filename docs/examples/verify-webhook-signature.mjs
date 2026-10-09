// Verifies a Payment Orchestrator webhook in your server (Node 18+, no dependencies).
// Use the RAW request body (the exact bytes received), not a re-serialized JSON object.
import { createHmac, timingSafeEqual } from 'node:crypto';

const TOLERANCE_SECONDS = 300; // reject signatures older than 5 minutes (replays)

/**
 * @param {string} rawBody   the request body exactly as received
 * @param {string} header    the `PO-Signature` header: "t=<unix seconds>,v1=<hex>"
 * @param {string} secret    the endpoint's signing secret (whsec_...)
 * @param {number} [now]     current Unix time in seconds (for tests)
 * @returns {boolean}
 */
export function verifyWebhookSignature(
  rawBody,
  header,
  secret,
  now = Math.floor(Date.now() / 1000),
) {
  const parts = Object.fromEntries(
    String(header)
      .split(',')
      .map((part) => part.split('=', 2)),
  );
  const timestamp = Number(parts.t);
  if (!Number.isInteger(timestamp) || !parts.v1) return false;
  if (Math.abs(now - timestamp) > TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest();
  const received = Buffer.from(parts.v1, 'hex');
  // Constant-time comparison: timing must not reveal how many bytes matched.
  return received.length === expected.length && timingSafeEqual(received, expected);
}

// Express example:
//   app.post('/webhooks', express.raw({ type: 'application/json' }), (req, res) => {
//     const raw = req.body.toString('utf8');
//     if (!verifyWebhookSignature(raw, req.get('PO-Signature'), process.env.PO_WEBHOOK_SECRET)) {
//       return res.sendStatus(400);
//     }
//     const event = JSON.parse(raw);
//     // Deliveries are at-least-once: skip event.id values you already processed.
//     res.sendStatus(200); // answer fast; do slow work after
//   });
