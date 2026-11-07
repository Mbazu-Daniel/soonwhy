import { Injectable } from "@nestjs/common";
import { WebhookService } from "../webhook.service";
import {
  BaseChannel,
  ChannelSendInput,
  ChannelSendResult,
} from "./base.channel";
import type { NotificationChannelType } from "../../../../common/db/schema";

@Injectable()
export class WebhookChannel extends BaseChannel {
  readonly type: NotificationChannelType = "webhook";

  constructor(private readonly webhook: WebhookService) {
    super();
  }

  async send(
    input: ChannelSendInput & {
      url: string;
      secret?: string;
      eventType?: string;
    },
  ): Promise<ChannelSendResult> {
    try {
      const result = await this.webhook.deliver({
        url: input.url,
        secret: input.secret,
        payload: {
          subject: input.subject,
          body: input.body,
          htmlBody: input.htmlBody,
          metadata: input.metadata,
          to: input.to,
        },
        eventType: input.eventType ?? "alert.triggered",
      });

      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      return { ok: true };
    } catch (error) {
      const err = error as {
        message?: string;
        response?: { data?: { error?: string } };
      };
      return {
        ok: false,
        error:
          err.response?.data?.error || err.message || "Webhook send failed",
      };
    }
  }
}
