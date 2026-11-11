import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import { OutboundHttpService } from "../../../common/resilience/outbound-http.service";
import { OutboundHttpError } from "../../../common/resilience/outbound-http.errors";

export interface WebhookDeliveryInput {
  url: string;
  secret?: string;
  payload: Record<string, unknown>;
  eventType: string;
  eventId?: string;
}

export interface WebhookDeliveryResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
}

@Injectable()
export class WebhookService {
  constructor(private readonly http: OutboundHttpService) {}

  async deliver(input: WebhookDeliveryInput): Promise<WebhookDeliveryResult> {
    const body = JSON.stringify(input.payload);
    const timestamp = Date.now().toString();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Soonwhy-Event": input.eventType,
      "X-Soonwhy-Timestamp": timestamp,
    };
    if (input.eventId) {
      headers["X-Soonwhy-Event-Id"] = input.eventId;
    }

    if (input.secret) {
      const signature = createHmac("sha256", input.secret)
        .update(`${timestamp}.${body}`)
        .digest("hex");
      headers["X-Soonwhy-Signature"] = `sha256=${signature}`;
    }

    try {
      const res = await this.http.request({
        url: input.url,
        preset: "webhook",
        source: "WebhookService.deliver",
        init: {
          method: "POST",
          headers,
          body,
        },
      });

      return {
        ok: res.ok,
        statusCode: res.status,
      };
    } catch (error) {
      return {
        ok: false,
        statusCode:
          error instanceof OutboundHttpError ? error.statusCode : undefined,
        error: (error as { message?: string }).message,
      };
    }
  }

  verifySignature(
    secret: string,
    body: string | Buffer,
    signature: string,
  ): boolean {
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    const expectedSig = `sha256=${expected}`;
    try {
      return timingSafeEqual(Buffer.from(expectedSig), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}
