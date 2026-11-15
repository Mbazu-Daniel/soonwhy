import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Query,
  Res,
  Req,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { z } from "zod";
import {
  auth,
  githubEnabled,
  googleEnabled,
  oidcProvider,
} from "../../../common/config/better-auth.config";
import {
  signInSchema,
  signUpSchema,
  type SignInInput,
  type SignUpInput,
} from "../../../shared";
import { recordAuditEvent } from "../../../common/audit-logs";
import { findInvitationByPublicId } from "../../../common/db/find-invitation-by-public-id";
import { AUTH_THROTTLE } from "../../../common/throttling/throttling.constants";

const SOCIAL_PROVIDERS = ["github", "google"] as const;
type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

const deleteAccountSchema = z.object({
  password: z.string().min(1).max(200).optional(),
});

const acceptInvitationSchema = z.object({
  invitationId: z.string().min(1).max(100),
});

@Controller("auth")
export class AuthController {
  @Get("providers")
  getProviders() {
    return {
      emailAndPassword: true,
      google: googleEnabled,
      github: githubEnabled,
      oidc: oidcProvider,
    };
  }

  @Get("sso")
  @Throttle(AUTH_THROTTLE)
  async ssoSignIn(
    @Query("callbackURL") callbackURL: string | undefined,
    @Res() response: Response,
  ) {
    if (!oidcProvider) {
      throw new BadRequestException("Single sign-on is not configured");
    }

    return this.startSignIn(
      oidcProvider.id,
      callbackURL,
      response,
      "Unable to start single sign-on",
    );
  }

  @Get("social/:provider")
  @Throttle(AUTH_THROTTLE)
  async socialSignIn(
    @Param("provider") provider: string,
    @Query("callbackURL") callbackURL: string | undefined,
    @Res() response: Response,
  ) {
    if (!SOCIAL_PROVIDERS.includes(provider as SocialProvider)) {
      throw new BadRequestException("Unsupported social provider");
    }

    const enabled = provider === "github" ? githubEnabled : googleEnabled;
    if (!enabled) {
      throw new BadRequestException(
        `${provider} authentication is not configured`,
      );
    }

    return this.startSignIn(
      provider,
      callbackURL,
      response,
      "Unable to start social authentication",
    );
  }

  private async startSignIn(
    provider: string,
    callbackURL: string | undefined,
    response: Response,
    failure: string,
  ) {
    const { headers, response: result } = await auth.api.signInSocial({
      body: {
        provider: provider as SocialProvider,
        callbackURL:
          callbackURL || process.env.FRONTEND_URL || "http://localhost:3000",
      },
      returnHeaders: true,
    });

    if (!result?.url) {
      throw new BadRequestException(failure);
    }

    const cookies = headers.getSetCookie();
    if (cookies.length > 0) response.setHeader("Set-Cookie", cookies);
    return response.redirect(result.url);
  }

  @Post("sign-up")
  @Throttle(AUTH_THROTTLE)
  async signUp(
    @Body({ schema: signUpSchema }) body: SignUpInput,
    @Req() req: Request,
  ) {
    const result = await auth.api.signUpEmail({
      body: {
        email: body.email,
        password: body.password,
        name: body.email.split("@")[0] ?? body.email,
      },
    });

    await recordAuditEvent({
      userId: result?.user?.id,
      action: "user.signUp",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return result;
  }

  @Post("sign-in")
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  async signIn(
    @Body({ schema: signInSchema }) body: SignInInput,
    @Req() req: Request,
  ) {
    const result = await auth.api.signInEmail({
      body: { email: body.email, password: body.password },
    });

    await recordAuditEvent({
      userId: result?.user?.id,
      action: "user.signIn",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return result;
  }

  @Post("sign-out")
  @HttpCode(HttpStatus.OK)
  async signOut(
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    const session = await auth.api.getSession({
      headers: authHeaders(headers),
    });

    await recordAuditEvent({
      userId: session?.user?.id,
      action: "user.signOut",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return auth.api.signOut({
      headers: authHeaders(headers),
    });
  }

  @Get("session")
  async getSession(@Headers() headers: Record<string, string>) {
    return auth.api.getSession({
      headers: authHeaders(headers),
    });
  }

  @Post("delete-account")
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @Body({ schema: deleteAccountSchema })
    body: z.output<typeof deleteAccountSchema>,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    const session = await auth.api.getSession({
      headers: authHeaders(headers),
    });

    const result = await auth.api.deleteUser({
      body: { password: body.password },
      headers: authHeaders(headers),
    });

    await recordAuditEvent({
      action: "user.delete",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: {
        userId: session?.user?.id,
        email: session?.user?.email,
      },
    });

    return result;
  }

  @Get("invitations/:id")
  async getInvitation(
    @Param("id") id: string,
    @Headers() headers: Record<string, string>,
  ) {
    const resolved = await findInvitationByPublicId(id);
    if (!resolved) throw new NotFoundException("Invitation not found");
    return auth.api.getInvitation({
      headers: authHeaders(headers),
      query: { id: resolved.id },
    });
  }

  @Post("invitations/accept")
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @Body({ schema: acceptInvitationSchema })
    body: z.output<typeof acceptInvitationSchema>,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    const resolved = await findInvitationByPublicId(body.invitationId);
    if (!resolved) throw new NotFoundException("Invitation not found");

    const result = await auth.api.acceptInvitation({
      headers: authHeaders(headers),
      body: { invitationId: resolved.id },
    });

    await recordAuditEvent({
      userId: result?.member?.userId,
      organizationId: result?.invitation?.organizationId,
      action: "invitation.accept",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata: { invitationId: body.invitationId },
    });

    return result;
  }
}

function authHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};

  if (headers.authorization) result.authorization = headers.authorization;
  if (headers.cookie) result.cookie = headers.cookie;

  return result;
}
