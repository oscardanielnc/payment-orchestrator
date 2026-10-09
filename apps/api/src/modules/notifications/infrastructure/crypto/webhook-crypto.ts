import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { AppConfig } from '../../../../config/app-config';
import { WebhookSecrets, WebhookSigner } from '../../application/ports/notification-ports';

/**
 * Signing secrets must be readable to sign, so they cannot be hashed like API keys.
 * They are encrypted with AES-256-GCM under a key that lives outside the database:
 * a database dump alone does not reveal them, and GCM's tag detects tampering.
 *
 *   stored = v1.<iv 12 bytes>.<auth tag 16 bytes>.<ciphertext>   (each part base64url)
 */
@Injectable()
export class AesGcmWebhookSecrets extends WebhookSecrets {
  private readonly key: Buffer;

  constructor(config: AppConfig) {
    super();
    this.key = Buffer.from(config.webhooks.secretsKey, 'base64');
  }

  generate(): string {
    return `whsec_${randomBytes(32).toString('base64url')}`;
  }

  encrypt(secret: string): string {
    const iv = randomBytes(12); // never reused with the same key: random per secret
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return ['v1', iv, cipher.getAuthTag(), ciphertext]
      .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
      .join('.');
  }

  decrypt(stored: string): string {
    const [version, iv, tag, ciphertext] = stored.split('.');
    if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Unknown secret format');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(), // throws if the ciphertext or the key is wrong
    ]).toString('utf8');
  }
}

/**
 * `PO-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>`. The timestamp
 * is inside the signed content, so an attacker cannot replay an old body with a new time.
 */
@Injectable()
export class HmacWebhookSigner extends WebhookSigner {
  sign(secret: string, body: string, timestamp: number): string {
    const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    return `t=${timestamp},v1=${digest}`;
  }
}
