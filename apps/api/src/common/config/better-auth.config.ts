import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer, organization } from 'better-auth/plugins';
import argon2 from 'argon2';
import { db } from '../db';
import * as schema from '../db/schema';

export const githubEnabled = Boolean(
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
);

export const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

function organizationNameFromEmail(email: string): string {
  const localPart = email.split('@')[0] ?? email;
  const words = localPart
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  return words.length
    ? words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : 'My Organization';
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      user: schema.users,
      account: schema.accounts,
      session: schema.sessions,
      organization: schema.organizations,
      member: schema.members,
      organizations: schema.organizations,
      members: schema.members,
    },
  }),
  advanced: {
    database: {
      generateId: false,
    },
  },
  emailAndPassword: {
    enabled: true,
    password: {
      hash: argon2.hash,
      verify: ({ hash, password }) => argon2.verify(hash, password),
    },
  },
  emailVerification: {
    sendOnSignUp: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  socialProviders: {
    ...(githubEnabled && {
      github: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
    }),
    ...(googleEnabled && {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      },
    }),
  },
  plugins: [
    bearer(),
    organization({
      schema: {
        organization: {
          modelName: 'organizations',
        },
        member: {
          modelName: 'members',
        },
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => ({
          data: {
            ...user,
            name: user.name?.trim() || organizationNameFromEmail(user.email),
          },
        }),
      },
    },
  },
  trustedOrigins: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
  ],
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3001',
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (() => {
      throw new Error('BETTER_AUTH_SECRET env var is required');
    })(),
});
