import { Controller, Post, Body, Get, Headers, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { signInSchema, signUpSchema } from '../../../shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-up')
  async signUp(@Body() body: unknown) {
    const parsed = signUpSchema.parse(body);
    return this.authService.signUp(parsed.email, parsed.password, parsed.name);
  }

  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() body: unknown) {
    const parsed = signInSchema.parse(body);
    return this.authService.signIn(parsed.email, parsed.password);
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.OK)
  async signOut(@Headers('authorization') authorization: string) {
    const token = authorization?.replace('Bearer ', '');
    return this.authService.signOut(token);
  }

  @Get('session')
  async getSession(@Headers('authorization') authorization: string) {
    const token = authorization?.replace('Bearer ', '');
    return this.authService.getSession(token);
  }
}
