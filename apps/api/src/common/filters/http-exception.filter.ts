import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: any = {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === 'string') {
        body.detail = exResponse;
      } else if (typeof exResponse === 'object') {
        body = { ...body, ...exResponse, status };
      }
    } else if (isApiError(exception)) {
      status = exception.statusCode;
      body.status = status;
      body.title = exception.message;
      body.detail = exception.body?.message ?? exception.message;
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      body.detail = process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : exception.message;
    }

    response.status(status).json(body);
  }
}

function isApiError(exception: unknown): exception is Error & {
  statusCode: number;
  body?: { message?: string };
} {
  return (
    exception instanceof Error &&
    'statusCode' in exception &&
    typeof exception.statusCode === 'number'
  );
}
