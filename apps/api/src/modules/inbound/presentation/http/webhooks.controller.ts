import { Controller, HttpCode, HttpStatus, Logger, Param, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ReceiveWebhookUseCase } from '../../application/use-cases/receive-webhook.use-case';
import { InvalidWebhookSignatureError } from '../../domain/errors';

/**
 * Public endpoint for providers. No API key: the signature is the authentication.
 * Uses the raw body (enabled with `rawBody: true` at bootstrap) because the signature
 * covers the exact bytes sent, not a re-serialized object.
 */
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly receive: ReceiveWebhookUseCase) {}

  @Post(':provider')
  @HttpCode(HttpStatus.OK)
  async handle(@Param('provider') provider: string, @Req() request: RawBodyRequest<Request>) {
    if (!request.rawBody) throw new InvalidWebhookSignatureError('empty body');
    const headers = Object.fromEntries(
      Object.entries(request.headers).map(([name, value]) => [
        name,
        Array.isArray(value) ? value.join(',') : value,
      ]),
    );
    try {
      const result = await this.receive.execute({ provider, rawBody: request.rawBody, headers });
      return { received: true, duplicate: result.duplicate };
    } catch (error) {
      // A rejected provider notification is otherwise silent (a 400 nobody reads): log the reason.
      if (error instanceof InvalidWebhookSignatureError) {
        this.logger.warn(`${provider} notification rejected: ${error.message}`);
      }
      throw error;
    }
  }
}
