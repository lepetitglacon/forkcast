import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/** Validates a request body/param with a Zod schema; `@Body(new ZodPipe(Schema))`. */
@Injectable()
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        message: result.error.issues.map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`).join('; '),
        code: 'VALIDATION',
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
