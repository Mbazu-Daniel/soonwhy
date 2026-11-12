import { z } from "zod/v4";

/**
 * Shared OpenAPI components. Reused across paths; `.meta({ id })` registers
 * each as a reusable `#/components/schemas/<id>` entry.
 */

export const problemDetailSchema = z
  .looseObject({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string().optional(),
    hint: z.string().optional(),
  })
  .meta({
    id: "ProblemDetail",
    description:
      "RFC 7807 problem details. Returned by the global exception filter for every error.",
    example: {
      type: "about:blank",
      title: "Invalid email or password",
      status: 401,
      detail: "Invalid email or password",
    },
  });

export const authProvidersSchema = z
  .object({
    emailAndPassword: z.boolean(),
    google: z.boolean(),
    github: z.boolean(),
  })
  .meta({
    id: "AuthProviders",
    description: "Which sign-in methods are configured on this instance.",
    example: { emailAndPassword: true, google: false, github: false },
  });

export const authUserSchema = z
  .looseObject({
    id: z.string(),
    email: z.email(),
    name: z.string().nullish(),
    image: z.string().nullish(),
    emailVerified: z.boolean(),
    createdAt: z.iso.datetime().nullish(),
    updatedAt: z.iso.datetime().nullish(),
  })
  .meta({
    id: "AuthUser",
    description: "User record returned by better-auth after (un)authenticating.",
  });

export const authSessionSchema = z
  .looseObject({
    id: z.string(),
    token: z.string(),
    userId: z.string().optional(),
    expiresAt: z.iso.datetime(),
    createdAt: z.iso.datetime().nullish(),
    updatedAt: z.iso.datetime().nullish(),
  })
  .meta({
    id: "AuthSession",
    description: "Opaque session token used as a Bearer credential.",
  });

export const authResultSchema = z
  .looseObject({
    user: authUserSchema,
    session: authSessionSchema.optional(),
    token: z.string().optional(),
    redirect: z.string().optional(),
  })
  .meta({
    id: "AuthResult",
    description:
      "Successful sign-in / sign-up result. `token` is present for programmatic clients; `session` for cookie-based browser flows.",
  });

export const authSessionResponseSchema = z
  .looseObject({
    session: authSessionSchema,
    user: authUserSchema,
  })
  .meta({
    id: "AuthSessionResponse",
    description: "Active session, or `null` when the request is unauthenticated.",
  });

export const signOutResultSchema = z
  .looseObject({
    success: z.boolean(),
  })
  .meta({
    id: "SignOutResult",
  });
