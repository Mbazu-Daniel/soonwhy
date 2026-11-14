import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { STATUS_CODES } from "node:http";
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
        if (!("detail" in exResponse)) {
          const exMessage = (exResponse as { message?: unknown }).message;
          const first = Array.isArray(exMessage)
            ? exMessage.find((entry): entry is string => typeof entry === "string")
            : typeof exMessage === "string"
              ? exMessage
              : undefined;
          if (first) body.detail = first;
        }
        if (
          !("title" in exResponse) &&
          typeof (exResponse as { error?: unknown }).error === "string"
        ) {
          body.title = (exResponse as { error: string }).error;
        } else if (!("title" in exResponse)) {
          body.title = STATUS_CODES[status] ?? body.title;
        }
        if (
          !("detail" in exResponse) &&
          body.detail === "An unexpected error occurred" &&
          "fieldErrors" in exResponse
        ) {
          body.detail = "Request validation failed";
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
