import { Catch, Inject, Optional, type ArgumentsHost } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import type { NodeSdk } from "@soonwhy/node";
import { SOONWHY_SDK } from "./constants.js";
import { shouldCapture } from "./exception-status.js";
import { requestContext } from "./request-context.js";

@Catch()
export class SoonwhyExceptionFilter extends BaseExceptionFilter {
  constructor(@Optional() @Inject(SOONWHY_SDK) private readonly sdk?: NodeSdk) {
    super();
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (this.sdk && shouldCapture(exception)) {
      this.sdk.captureError({
        error: exception,
        attributes: {
          "exception.mechanism": "nest.exception_filter",
          ...requestContext(exception, host),
        },
      });
    }
    super.catch(exception, host);
  }
}
