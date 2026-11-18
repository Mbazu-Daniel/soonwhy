import { Injectable } from "@nestjs/common";
import { ResilienceService } from "@nestjs/resilience";
import {
  RETRYABLE_HTTP_STATUS_FLOOR,
  RETRYABLE_HTTP_STATUSES,
} from "./resilience.constants";
import { OutboundHttpError } from "./outbound-http.errors";
import type { OutboundRequestInput } from "./resilience.types";
import { assertPublicHttpUrl } from "../net/public-address";
import { publicHttpRequest } from "../net/public-http";

function isRetryableStatus(status: number): boolean {
  return status >= RETRYABLE_HTTP_STATUS_FLOOR || RETRYABLE_HTTP_STATUSES.has(status);
}

@Injectable()
export class OutboundHttpService {
  constructor(private readonly resilience: ResilienceService) {}

  async request(input: OutboundRequestInput): Promise<Response> {
    if (input.publicOnly) await assertPublicHttpUrl(input.url);
    return this.resilience.preset(input.preset).execute(
      async ({ signal }) => {
        const response = input.publicOnly
          ? await this.sendToPublicHost(input, signal)
          : await fetch(input.url, { ...input.init, signal });

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

  private async sendToPublicHost(input: OutboundRequestInput, signal: AbortSignal): Promise<Response> {
    const { status } = await publicHttpRequest({
      url: input.url,
      method: input.init?.method,
      headers: input.init?.headers,
      body: input.init?.body,
      signal,
    });
    return new Response(null, { status });
  }
}
