import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, organization } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import argon2 from "argon2";
import { and, eq, sql } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "../db";
import * as schema from "../db/schema";
import * as dotenv from "dotenv";
dotenv.config();

export const githubEnabled = Boolean(
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
);

export const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

function organizationNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? email;
  const first = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)[0];

  if (!first) return "My Organization";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const resendFrom =
  process.env.RESEND_FROM ??
  process.env.DEFAULT_FROM_EMAIL ??
  "Soonwhy <noreply@oktopals.com>";
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

async function sendInvitationEmail(input: {
  id: string;
  email: string;
  role: string;
  organization: { name: string; slug: string };
  inviter: { user: { name: string | null; email: string } };
}) {
  if (!resend) {
    console.warn("RESEND_API_KEY is not configured; skipping invitation email");
    return;
  }
  const acceptUrl = `${frontendUrl}/accept-invitation/${input.id}`;
  const inviterName = input.inviter.user.name || input.inviter.user.email;
  await resend.emails.send({
    from: resendFrom,
    to: [input.email],
    subject: `${inviterName} invited you to ${input.organization.name} on Soonwhy`,
    text: [
      `${inviterName} invited you to join “${input.organization.name}” on Soonwhy as ${input.role}.`,
      "",
      `Accept the invitation: ${acceptUrl}`,
      "",
      "This invitation expires in 48 hours. If you were not expecting it, you can ignore this email.",
    ].join("\n"),
    html: [
      `<p>${escapeHtml(inviterName)} invited you to join <strong>${escapeHtml(input.organization.name)}</strong> on Soonwhy as <strong>${escapeHtml(input.role)}</strong>.</p>`,
      `<p><a href="${acceptUrl}">Accept the invitation</a></p>`,
      `<p style="color:#666;font-size:12px">This invitation expires in 48 hours. If you were not expecting it, you can ignore this email.</p>`,
    ].join(""),
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function assertCanDeleteUser(user: { id: string; email: string }) {
  const ownedRows = await db
    .select({ id: schema.members.id, organizationId: schema.members.organizationId })
    .from(schema.members)
    .innerJoin(
      schema.organizations,
      and(
        eq(schema.organizations.id, schema.members.organizationId),
        sql`${schema.organizations.deletedAt} is null`,
      ),
    )
    .where(
      and(
        eq(schema.members.userId, user.id),
        sql`string_to_array(${schema.members.role}, ',') @> ARRAY['owner']::text[]`,
      ),
    );

  for (const owned of ownedRows) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.members)
      .where(
        and(
          eq(schema.members.organizationId, owned.organizationId),
          sql`string_to_array(${schema.members.role}, ',') @> ARRAY['owner']::text[]`,
        ),
      );
    if ((row?.count ?? 0) <= 1) {
      const [org] = await db
        .select({ name: schema.organizations.name })
        .from(schema.organizations)
        .where(eq(schema.organizations.id, owned.organizationId));
      throw new APIError("BAD_REQUEST", {
        message: `You are the only owner of “${org?.name ?? "an organization"}”. Transfer ownership or delete the organization before deleting your account.`,
      });
    }
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    transaction: true,
    schema: {
      user: schema.users,
      account: schema.accounts,
      session: schema.sessions,
      organization: schema.organizations,
      member: schema.members,
      organizations: schema.organizations,
      members: schema.members,
      invitation: schema.invitations,
      invitations: schema.invitations,
      auditLogs: schema.auditLogs,
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
  // emailVerification: {
  //   sendOnSignUp: true,
  // },
  user: {
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        await assertCanDeleteUser(user);
      },
    },
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
      // This deployment has no email verification flow wired up, so waiting
      // for one would deadlock credential sign-ups from accepting invites.
      // Recipient matching (invited email must match the session email) still
      // applies, and invitation ids are unguessable.
      requireEmailVerificationOnInvitation: false,
      schema: {
        organization: {
          modelName: "organizations",
        },
        member: {
          modelName: "members",
          additionalFields: {
            name: {
              type: "string",
              required: false,
              input: false,
            },
            avatar: {
              type: "string",
              required: false,
              input: false,
            },
          },
        },
        invitation: {
          modelName: "invitations",
        },
      },
      sendInvitationEmail: async (input) => {
        try {
          await sendInvitationEmail(input);
        } catch (error) {
          console.error(
            "Failed to send invitation email:",
            error instanceof Error ? error.message : error,
          );
        }
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
  trustedOrigins: [process.env.FRONTEND_URL || "http://localhost:3000"],
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:8080",
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (() => {
      throw new Error("BETTER_AUTH_SECRET env var is required");
    })(),
});
