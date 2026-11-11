import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";
import { maskPii } from "../privacy/pii-masker";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("ExceptionFilter");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: any = {
      type: "about:blank",
      title: "Internal Server Error",
      status: 500,
      detail: "An unexpected error occurred",
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === "string") {
        body.detail = exResponse;
      } else if (typeof exResponse === "object") {
        body = { ...body, ...exResponse, status };
        // Object-form exceptions (e.g. ForbiddenException) commonly carry a
        // `message`; without this, the client saw the opaque default detail.
        if (
          !("detail" in exResponse) &&
          typeof (exResponse as { message?: unknown }).message === "string"
        ) {
          body.detail = (exResponse as { message: string }).message;
        }
      }
    } else if (isApiError(exception)) {
      status = exception.statusCode;
      body.status = status;
      body.title = exception.message;
      body.detail = exception.body?.message ?? exception.message;
    } else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled error: ${maskPii(exception.message)}`,
        exception.stack ? maskPii(exception.stack) : undefined,
      );
      body.detail =
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : maskPii(exception.message);
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
    "statusCode" in exception &&
    typeof exception.statusCode === "number"
  );
}
