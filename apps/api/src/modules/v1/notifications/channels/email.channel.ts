import { Injectable } from "@nestjs/common";
import { ZeptoMailService } from "../zepto-mail.service";
import {
  BaseChannel,
  ChannelSendInput,
  ChannelSendResult,
} from "./base.channel";
import type { NotificationChannelType } from "../../../../common/db/schema";

@Injectable()
export class EmailChannel extends BaseChannel {
  readonly type: NotificationChannelType = "email";

  constructor(private readonly zeptoMail: ZeptoMailService) {
    super();
  }

  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    const fromEmail = process.env.ZEPTOMAIL_FROM_EMAIL;
    const fromName = process.env.ZEPTOMAIL_FROM_NAME ?? "Soonwhy";

    if (!fromEmail) {
      return { ok: false, error: "ZEPTOMAIL_FROM_EMAIL is not configured" };
    }

    try {
      await this.zeptoMail.send({
        from: { name: fromName, address: fromEmail },
        to: input.to.map((email) => ({ email_address: email })),
        subject: input.subject,
        htmlbody: input.htmlBody ?? input.body,
        textbody: input.body,
      });

      return { ok: true };
    } catch (error) {
      const err = error as {
        message?: string;
        response?: { data?: { message?: string } };
      };
      return {
        ok: false,
        error:
          err.response?.data?.message || err.message || "Email send failed",
      };
    }
  }
}
