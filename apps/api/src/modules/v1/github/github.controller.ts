import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { GithubService } from "./github.service";

@Controller("github")
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: Request,
    @Headers("x-github-event") event: string | undefined,
    @Headers("x-hub-signature-256") signature: string | undefined,
    @Headers("x-github-delivery") deliveryId: string | undefined,
    @Body() _body: unknown,
  ) {
    const secret = this.githubService.verifyWebhookSecret();
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      throw new UnauthorizedException("Invalid GitHub webhook payload");
    }

    if (!this.githubService.verifySignature(rawBody, signature, secret)) {
      throw new UnauthorizedException("Invalid GitHub webhook signature");
    }

    return this.githubService.handlePushEvent(rawBody, event, deliveryId);
  }
}
