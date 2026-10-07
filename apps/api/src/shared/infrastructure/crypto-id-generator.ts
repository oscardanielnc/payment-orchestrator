import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { IdGenerator } from '../application/ports/id-generator';

@Injectable()
export class CryptoIdGenerator extends IdGenerator {
  uuid(): string {
    return randomUUID();
  }

  secureToken(): string {
    return randomBytes(16).toString('base64url');
  }
}
