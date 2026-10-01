import { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { RequestValidationError } from './http-problems';

/** Validates and parses input with a contract schema: `@Body(new ZodValidationPipe(Schema))`. */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new RequestValidationError(
      result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(body)',
        message: issue.message,
      })),
    );
  }
}
