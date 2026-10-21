import { Logger, OnModuleInit } from '@nestjs/common';
import type { MercadoPagoApi } from './mercadopago-client';

export class MercadoPagoNotTestUserError extends Error {
  constructor(detail: string) {
    super(
      `MERCADOPAGO_ACCESS_TOKEN must belong to a Mercado Pago test user (${detail}); ` +
        'this repository never runs live (ADR 0006, ADR 0022)',
    );
    this.name = 'MercadoPagoNotTestUserError';
  }
}

/**
 * Mercado Pago test tokens start with APP_USR- like live ones, so the format proves nothing.
 * At boot we ask Mercado Pago who owns the token and refuse to start unless it is a test user.
 * Fails closed: if the question cannot be answered, the app does not start either.
 */
export class MercadoPagoTestUserCheck implements OnModuleInit {
  private readonly logger = new Logger(MercadoPagoTestUserCheck.name);

  constructor(private readonly api: MercadoPagoApi) {}

  async onModuleInit(): Promise<void> {
    let tags: string[];
    try {
      tags = (await this.api.me()).tags ?? [];
    } catch (error) {
      throw new MercadoPagoNotTestUserError(`could not verify: ${(error as Error).message}`);
    }
    if (!tags.includes('test_user')) throw new MercadoPagoNotTestUserError('no test_user tag');
    this.logger.log('Mercado Pago token belongs to a test user');
  }
}
