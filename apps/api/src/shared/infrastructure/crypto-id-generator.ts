import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IdGenerator } from '../application/ports/id-generator';

@Injectable()
export class CryptoIdGenerator extends IdGenerator {
  uuid(): string {
    return randomUUID();
  }
}
