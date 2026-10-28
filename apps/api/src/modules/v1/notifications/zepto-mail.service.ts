import { Injectable, BadRequestException } from "@nestjs/common";

export interface ZeptoMailSendInput {
  from: { name: string; address: string };
  to: { email_address: string }[];
  subject: string;
  htmlbody?: string;
  textbody?: string;
}

export interface ZeptoMailSendResponse {
  status: string;
  message: string;
  data: {
    message_id: string;
    status: string;
    to: Array<{ email_address: string; message_id: string; status: string }>;
  };
}

@Injectable()
export class ZeptoMailService {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor() {
    const apiKey = process.env.ZEPTOMAIL_API_KEY;
    const region = process.env.ZEPTOMAIL_REGION ?? "com";

    if (!apiKey) {
      throw new BadRequestException("ZEPTOMAIL_API_KEY is not configured");
    }

    this.baseUrl = `https://api.zeptomail.${region}/v1/email`;
    this.authHeader = `Zoho-enczapikey ${apiKey}`;
  }

  async send(input: ZeptoMailSendInput): Promise<ZeptoMailSendResponse> {
    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        from: input.from,
        to: input.to,
        subject: input.subject,
        ...(input.htmlbody ? { htmlbody: input.htmlbody } : {}),
        ...(input.textbody ? { textbody: input.textbody } : {}),
      }),
    });

    const data = (await res.json()) as ZeptoMailSendResponse;

    if (!res.ok) {
      throw new BadRequestException(
        data.message || `ZeptoMail API error: ${res.status}`,
      );
    }

    return data;
  }
}
