import { Injectable } from "@nestjs/common";
import { ZeptoMailService } from "../zepto-mail.service";
import { ChannelSendInput, ChannelSendResult } from "./base.channel";

@Injectable()
export class EmailChannel {
  constructor(private readonly zeptoMail: ZeptoMailService) {}

  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    const fromEmail = process.env.DEFAULT_FROM_EMAIL ?? "noreply@localhost";
    const fromName = "Soonwhy";

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
