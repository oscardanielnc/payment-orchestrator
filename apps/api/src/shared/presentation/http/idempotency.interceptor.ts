import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { from, lastValueFrom, Observable } from 'rxjs';
import { IdempotencyStore } from '../../application/ports/idempotency-store';
import { TransactionRunner } from '../../application/ports/transaction-runner';
import { IdempotencyKeyRequiredError, IdempotencyKeyReusedError } from './http-problems';

interface ScopedRequest extends Request {
  principal?: { organizationId: string };
}

/**
 * ADR 0007. Claim key → run the handler → store its response, all in ONE transaction:
 * - a crash or error rolls everything back, freeing the key for a retry
 * - a concurrent duplicate waits on the key's unique index, then replays the response
 * Requires an authenticated principal: keys are scoped per organization.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly store: IdempotencyStore,
    private readonly transaction: TransactionRunner,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<ScopedRequest>();
    const response = http.getResponse<Response>();

    const key = request.header('idempotency-key');
    if (!key || key.length > 255) throw new IdempotencyKeyRequiredError();
    const scope = request.principal?.organizationId;
    if (!scope) throw new Error('IdempotencyInterceptor must run after an auth guard');

    const requestHash = fingerprint(request);
    const statusCode =
      this.reflector.get<number | undefined>(HTTP_CODE_METADATA, context.getHandler()) ??
      (request.method === 'POST' ? HttpStatus.CREATED : HttpStatus.OK);

    return from(
      this.transaction.run(async () => {
        const claim = await this.store.claim(scope, key, requestHash);
        if (claim.outcome === 'replay') {
          if (claim.requestHash !== requestHash) throw new IdempotencyKeyReusedError();
          response.setHeader('Idempotent-Replayed', 'true');
          response.status(claim.response.statusCode);
          return claim.response.body;
        }

        const body: unknown = await lastValueFrom(next.handle());
        await this.store.complete(scope, key, { statusCode, body });
        return body;
      }),
    );
  }
}

/** Same method + path + body (key order ignored) → same fingerprint. */
function fingerprint(request: Request): string {
  const canonical = `${request.method} ${request.path} ${stableStringify(request.body)}`;
  return createHash('sha256').update(canonical).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
