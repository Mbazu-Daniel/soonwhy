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
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { auth, githubEnabled, googleEnabled } from '../../../common/config/better-auth.config';
import { signInSchema, signUpSchema } from '../../../shared';

const SOCIAL_PROVIDERS = ['github', 'google'] as const;
type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

@Controller('auth')
export class AuthController {
  @Get('providers')
  getProviders() {
    return {
      emailAndPassword: true,
      google: googleEnabled,
      github: githubEnabled,
    };
  }

  @Get('social/:provider')
  async socialSignIn(
    @Param('provider') provider: string,
    @Query('callbackURL') callbackURL: string | undefined,
    @Res() response: Response,
  ) {
    if (!SOCIAL_PROVIDERS.includes(provider as SocialProvider)) {
      throw new BadRequestException('Unsupported social provider');
    }

    const enabled = provider === 'github' ? githubEnabled : googleEnabled;
    if (!enabled) {
      throw new BadRequestException(`${provider} authentication is not configured`);
    }

    const result = await auth.api.signInSocial({
      body: {
        provider: provider as SocialProvider,
        callbackURL: callbackURL || process.env.FRONTEND_URL || 'http://localhost:3000',
      },
    });

    if (!result?.url) {
      throw new BadRequestException('Unable to start social authentication');
    }

    return response.redirect(result.url);
  }

  @Post('sign-up')
  async signUp(@Body() body: unknown) {
    const parsed = signUpSchema.parse(body);
    return auth.api.signUpEmail({
      body: {
        email: parsed.email,
        password: parsed.password,
      },
    });
  }

  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() body: unknown) {
    const parsed = signInSchema.parse(body);
    return auth.api.signInEmail({
      body: { email: parsed.email, password: parsed.password },
    });
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.OK)
  async signOut(@Headers() headers: Record<string, string>) {
    return auth.api.signOut({
      headers: authHeaders(headers),
    });
  }

  @Get('session')
  async getSession(@Headers() headers: Record<string, string>) {
    return auth.api.getSession({
      headers: authHeaders(headers),
    });
  }
}

function authHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};

  if (headers.authorization) result.authorization = headers.authorization;
  if (headers.cookie) result.cookie = headers.cookie;

  return result;
}

function nameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? email;
  const words = localPart
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  return words.length
    ? words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : 'SoonWhy User';
}
