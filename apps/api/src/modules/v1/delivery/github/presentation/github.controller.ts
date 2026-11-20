import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { GithubService } from "../application/github.service";

@Controller("github")
export class GithubController {
  constructor(private readonly githubService: GithubService) {}

  @Post("webhook/:hookId")
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Req() req: Request,
    @Param("hookId") hookId: string,
    @Headers("x-github-event") event: string | undefined,
    @Headers("x-hub-signature-256") signature: string | undefined,
    @Headers("x-github-delivery") deliveryId: string | undefined,
  ) {
    const secret = this.githubService.secretForProject(hookId);
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody) {
      throw new UnauthorizedException("Invalid GitHub webhook payload");
    }

    if (!this.githubService.verifySignature(rawBody, signature, secret)) {
      throw new UnauthorizedException("Invalid GitHub webhook signature");
    }

    return this.githubService.handlePushEvent(hookId, rawBody, event, deliveryId);
  }
}
