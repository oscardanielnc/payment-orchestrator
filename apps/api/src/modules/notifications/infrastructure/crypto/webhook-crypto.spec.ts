import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import type { AppConfig } from '../../../../config/app-config';
import { AesGcmWebhookSecrets, HmacWebhookSigner } from './webhook-crypto';

type Verify = (body: string, header: string, secret: string, now?: number) => boolean;

const config = (byte: number) =>
  ({ webhooks: { secretsKey: Buffer.alloc(32, byte).toString('base64') } }) as AppConfig;

describe('webhook secrets (AES-256-GCM)', () => {
  const secrets = new AesGcmWebhookSecrets(config(7));

  it('round-trips a generated secret, with a fresh IV each time', () => {
    const secret = secrets.generate();
    const first = secrets.encrypt(secret);
    const second = secrets.encrypt(secret);

    expect(secret).toMatch(/^whsec_[\w-]{43}$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain(secret);
    expect(secrets.decrypt(first)).toBe(secret);
  });

  it('refuses a tampered ciphertext or the wrong key', () => {
    const stored = secrets.encrypt(secrets.generate());
    const [v, iv, tag, ct = ''] = stored.split('.');
    const flipped = `${v}.${iv}.${tag}.${ct.startsWith('A') ? 'B' : 'A'}${ct.slice(1)}`;

    expect(() => secrets.decrypt(flipped)).toThrow();
    expect(() => new AesGcmWebhookSecrets(config(8)).decrypt(stored)).toThrow();
  });
});

describe('webhook signature', () => {
  // The snippet published in docs/examples is the one merchants copy: test that one.
  let verify: Verify;
  beforeAll(async () => {
    const path = resolve(
      __dirname,
      '../../../../../../../docs/examples/verify-webhook-signature.mjs',
    );
    ({ verifyWebhookSignature: verify } = (await import(pathToFileURL(path).href)) as {
      verifyWebhookSignature: Verify;
    });
  });

  const secret = 'whsec_test-secret'; // gitleaks:allow (made-up test secret)
  const body = '{"id":"evt-1","type":"charge.succeeded"}';
  const now = 1_791_000_000;
  const header = new HmacWebhookSigner().sign(secret, body, now);

  it('is accepted by the documented verification snippet', () => {
    expect(header).toMatch(/^t=1791000000,v1=[0-9a-f]{64}$/);
    expect(verify(body, header, secret, now)).toBe(true);
  });

  it('is rejected when the body, the secret or the time window is wrong', () => {
    expect(verify(body.replace('succeeded', 'failed'), header, secret, now)).toBe(false);
    expect(verify(body, header, 'whsec_other', now)).toBe(false);
    expect(verify(body, header, secret, now + 301)).toBe(false); // replayed later
    expect(verify(body, header.replace(/t=\d+/, `t=${now + 10}`), secret, now)).toBe(false);
  });
});
