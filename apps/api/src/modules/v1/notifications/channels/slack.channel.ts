import { Injectable } from "@nestjs/common";
import { SlackService } from "../slack.service";
import {
  BaseChannel,
  ChannelSendInput,
  ChannelSendResult,
} from "./base.channel";
import type { NotificationChannelType } from "../../../../common/db/schema";

@Injectable()
export class SlackChannel extends BaseChannel {
  readonly type: NotificationChannelType = "slack";

  constructor(private readonly slack: SlackService) {
    super();
  }

  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    return {
      ok: false,
      error: "Use SlackChannel#sendTo with a target channel",
    };
  }

  async sendTo(
    botToken: string,
    channel: string,
    input: ChannelSendInput,
  ): Promise<ChannelSendResult> {
    try {
      const result = await this.slack.sendMessage(botToken, {
        channel,
        text: input.body,
        blocks: input.htmlBody
          ? [
              {
                type: "section",
                text: { type: "mrkdwn", text: input.htmlBody },
              },
              { type: "divider" },
            ]
          : undefined,
      });

      if (!result.ok) {
        return { ok: false, error: result.error };
      }

      return { ok: true, providerMessageId: result.ts };
    } catch (error) {
      const err = error as {
        message?: string;
        response?: { data?: { error?: string } };
      };
      return {
        ok: false,
        error:
          err.response?.data?.error || err.message || "Slack send failed",
      };
    }
  }
}
