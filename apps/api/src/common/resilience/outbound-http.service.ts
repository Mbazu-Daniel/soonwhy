import { Injectable } from "@nestjs/common";
import { ResilienceService } from "@nestjs/resilience";
import {
  RETRYABLE_HTTP_STATUS_FLOOR,
  RETRYABLE_HTTP_STATUSES,
} from "./resilience.constants";
import { OutboundHttpError } from "./outbound-http.errors";
import type { OutboundRequestInput } from "./resilience.types";

function isRetryableStatus(status: number): boolean {
  return status >= RETRYABLE_HTTP_STATUS_FLOOR || RETRYABLE_HTTP_STATUSES.has(status);
}

@Injectable()
export class OutboundHttpService {
  constructor(private readonly resilience: ResilienceService) {}

  request(input: OutboundRequestInput): Promise<Response> {
    return this.resilience.preset(input.preset).execute(
      async ({ signal }) => {
        const response = await fetch(input.url, {
          ...input.init,
          signal,
        });

        if (isRetryableStatus(response.status)) {
          throw new OutboundHttpError(
            response.status,
            `${input.source} received HTTP ${response.status}`,
          );
        }

        return response;
      },
      { source: input.source },
    );
  }
}
