import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { OutboundHttpService } from "../../../common/resilience/outbound-http.service";

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

  constructor(private readonly http: OutboundHttpService) {
    const apiKey = process.env.ZEPTOMAIL_API_KEY;
    const region = "com";

    if (!apiKey) {
      throw new BadRequestException("ZEPTOMAIL_API_KEY is not configured");
    }

    this.baseUrl = `https://api.zeptomail.${region}/v1/email`;
    this.authHeader = `Zoho-enczapikey ${apiKey}`;
  }

  async send(input: ZeptoMailSendInput): Promise<ZeptoMailSendResponse> {
    const res = await this.http.request({
      url: this.baseUrl,
      preset: "email",
      source: "ZeptoMailService.send",
      init: {
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
      },
    });

    const data = (await res.json().catch(() => null)) as ZeptoMailSendResponse | null;

    if (!res.ok) {
      const message = data?.message ?? `ZeptoMail API error: ${res.status}`;
      if (res.status >= 500) {
        throw new ServiceUnavailableException(message);
      }
      if (res.status === 429) {
        throw new BadRequestException(message);
      }
      throw new BadRequestException(message);
    }

    return data!;
  }
}
