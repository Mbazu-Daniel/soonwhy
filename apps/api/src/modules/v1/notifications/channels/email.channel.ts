import { Injectable } from "@nestjs/common";
import { ZeptoMailService } from "../zepto-mail.service";
import { ResendMailService } from "../resend-mail.service";
import { ChannelSendInput, ChannelSendResult } from "./base.channel";

@Injectable()
export class EmailChannel {
  constructor(
    private readonly zeptoMail: ZeptoMailService,
    private readonly resendMail: ResendMailService,
  ) {}

  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    const provider = (process.env.EMAIL_PROVIDER ?? "resend")
      .trim()
      .toLowerCase();
    const fromEmail = process.env.DEFAULT_FROM_EMAIL ?? "noreply@localhost";
    const fromName = "Soonwhy";

    try {
      if (provider === "zeptomail") {
        await this.zeptoMail.send({
          from: { name: fromName, address: fromEmail },
          to: input.to.map((email) => ({ email_address: email })),
          subject: input.subject,
          htmlbody: input.htmlBody ?? input.body,
          textbody: input.body,
        });
      } else if (provider === "resend") {
        await this.resendMail.send({
          to: input.to,
          subject: input.subject,
          html: input.htmlBody ?? input.body,
          text: input.body,
        });
      } else {
        return {
          ok: false,
          error: `Unknown EMAIL_PROVIDER "${provider}" (expected "resend" or "zeptomail")`,
        };
      }

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
