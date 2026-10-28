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
    @Body() body: unknown,
  ) {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const payload = rawBody ?? Buffer.from(JSON.stringify(body ?? {}));

    if (!this.githubService.verifySignature(payload, signature, secret)) {
      throw new UnauthorizedException("Invalid GitHub webhook signature");
    }

    return this.githubService.handlePushEvent(payload, event);
  }
}
