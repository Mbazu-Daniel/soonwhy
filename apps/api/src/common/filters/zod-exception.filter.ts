import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ZodError } from 'zod';

@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const messages = exception.errors.map(
      (e) => `${e.path.join('.')}: ${e.message}`,
    );

    response.status(HttpStatus.BAD_REQUEST).json({
      type: 'validation_error',
      title: 'Validation failed',
      status: 400,
      detail: messages.join(', '),
      errors: exception.errors,
    });
  }
}
