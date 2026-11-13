import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Resend, type CreateEmailOptions } from "resend";

export interface ResendSendInput {
  to: string[];
  subject: string;
  html?: string;
  text?: string;
}

export interface ResendSendResponse {
  id: string | null;
}

@Injectable()
export class ResendMailService {
  private readonly client: Resend | null;
  private readonly from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;

    this.from =
      process.env.RESEND_FROM ??
      process.env.DEFAULT_FROM_EMAIL ??
      "Soonwhy <noreply@oktopals.com>";
    this.client = apiKey ? new Resend(apiKey) : null;
  }

  async send(input: ResendSendInput): Promise<ResendSendResponse> {
    if (!this.client) {
      throw new BadRequestException("RESEND_API_KEY is not configured");
    }

    const html = input.html;
    const text = input.text;
    if (!html && !text) {
      throw new BadRequestException("Either html or text body is required");
    }

    const base = {
      from: this.from,
      to: input.to,
      subject: input.subject,
    };
    const payload: CreateEmailOptions = html
      ? { ...base, html, ...(text ? { text } : {}) }
      : { ...base, text: text ?? "" };

    const { data, error } = await this.client.emails.send(payload);

    if (error) {
      const message = error.message ?? "Resend API error";
      if (
        error.statusCode === null ||
        error.statusCode >= 500 ||
        error.name === "application_error" ||
        error.name === "internal_server_error"
      ) {
        throw new ServiceUnavailableException(message);
      }
      throw new BadRequestException(message);
    }

    return { id: data?.id ?? null };
  }
}
