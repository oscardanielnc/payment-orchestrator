import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError } from '../../domain/domain-error';
import { HttpProblem } from './http-problems';

/** RFC 9457 body. `code` is the stable extension clients branch on. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  code: string;
  [extension: string]: unknown;
}

/** The one place where domain errors become HTTP statuses. Unlisted domain errors are 422. */
const DOMAIN_ERROR_STATUS: Record<string, number> = {
  'api_key.invalid': HttpStatus.UNAUTHORIZED,
  'api_key.not_found': HttpStatus.NOT_FOUND,
  'api_key.invalid_name': HttpStatus.BAD_REQUEST,
  'organization.not_found': HttpStatus.NOT_FOUND,
  'organization.invalid_name': HttpStatus.BAD_REQUEST,
  'charge.not_found': HttpStatus.NOT_FOUND,
  'charge.invalid_amount': HttpStatus.BAD_REQUEST,
  'charge.invalid_cursor': HttpStatus.BAD_REQUEST,
  'money.unsupported_currency': HttpStatus.BAD_REQUEST,
  'concurrency.conflict': HttpStatus.CONFLICT,
  'webhook.invalid_signature': HttpStatus.BAD_REQUEST,
  'webhook.unknown_provider': HttpStatus.NOT_FOUND,
};

const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Content',
  500: 'Internal Server Error',
};

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const problem = this.toProblem(exception, request.originalUrl);

    response.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(exception: unknown, instance: string): ProblemDetails {
    if (exception instanceof DomainError) {
      const status = DOMAIN_ERROR_STATUS[exception.code] ?? HttpStatus.UNPROCESSABLE_ENTITY;
      return this.problem(status, exception.code, instance, exception.message);
    }
    if (exception instanceof HttpProblem) {
      return {
        ...this.problem(exception.status, exception.code, instance, exception.message),
        ...exception.extensions,
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return this.problem(status, `http.${status}`, instance, exception.message);
    }
    this.logger.error(exception);
    return this.problem(HttpStatus.INTERNAL_SERVER_ERROR, 'internal_error', instance);
  }

  private problem(status: number, code: string, instance: string, detail?: string): ProblemDetails {
    return {
      type: 'about:blank',
      title: TITLES[status] ?? 'Error',
      status,
      ...(detail ? { detail } : {}),
      instance,
      code,
    };
  }
}
