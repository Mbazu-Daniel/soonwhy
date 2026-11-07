import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";

export interface WebhookDeliveryInput {
  url: string;
  secret?: string;
  payload: Record<string, unknown>;
  eventType: string;
}

export interface WebhookDeliveryResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
}

@Injectable()
export class WebhookService {
  async deliver(input: WebhookDeliveryInput): Promise<WebhookDeliveryResult> {
    const body = JSON.stringify(input.payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Soonwhy-Event": input.eventType,
      "X-Soonwhy-Timestamp": Date.now().toString(),
    };

    if (input.secret) {
      const signature = createHmac("sha256", input.secret)
        .update(body)
        .digest("hex");
      headers["X-Soonwhy-Signature"] = `sha256=${signature}`;
    }

    try {
      const res = await fetch(input.url, {
        method: "POST",
        headers,
        body,
      });

      return {
        ok: res.ok,
        statusCode: res.status,
      };
    } catch (error) {
      return {
        ok: false,
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
