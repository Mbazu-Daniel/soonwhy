import { Injectable } from '@nestjs/common';
import { auth } from '../../../common/config/better-auth.config';

@Injectable()
export class AuthService {
  async signUp(email: string, password: string, name: string) {
    return auth.api.signUpEmail({
      body: { email, password, name },
    });
  }

  async signIn(email: string, password: string) {
    return auth.api.signInEmail({
      body: { email, password },
    });
  }

  async signOut(sessionToken: string) {
    return auth.api.signOut({
      headers: { authorization: `Bearer ${sessionToken}` },
    });
  }

  async getSession(sessionToken: string) {
    return auth.api.getSession({
      headers: { authorization: `Bearer ${sessionToken}` },
    });
  }
}
