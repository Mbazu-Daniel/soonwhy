import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        const messages = error.errors.map((e: { path: (string | number)[]; message: string }) => `${e.path.join('.')}: ${e.message}`);
        throw new BadRequestException({
          type: 'validation_error',
          title: 'Validation failed',
          status: 400,
          detail: messages.join(', '),
          errors: error.errors,
        });
      }
      throw error;
    }
  }
}
