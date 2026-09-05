import { Controller, Post, Body, Get, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { auth } from '../../../common/config/better-auth.config';
import { signInSchema, signUpSchema } from '../../../shared';

@Controller('auth')
export class AuthController {
  @Post('sign-up')
  async signUp(@Body() body: unknown) {
    const parsed = signUpSchema.parse(body);
    return auth.api.signUpEmail({
      body: { email: parsed.email, password: parsed.password, name: parsed.name },
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
  async signOut(@Headers('authorization') authorization: string) {
    const token = authorization?.replace('Bearer ', '');
    return auth.api.signOut({
      headers: { authorization: `Bearer ${token}` },
    });
  }

  @Get('session')
  async getSession(@Headers('authorization') authorization: string) {
    const token = authorization?.replace('Bearer ', '');
    return auth.api.getSession({
      headers: { authorization: `Bearer ${token}` },
    });
  }
}
