import { z } from "zod/v4";
import {
  authProvidersSchema,
  authResultSchema,
  authSessionResponseSchema,
  problemDetailSchema,
  signOutResultSchema,
} from "./components";
import { signInSchema, signUpSchema } from "../../shared/schemas/auth";

const problemResponse = (description: string) => ({
  description,
  content: {
    "application/json": { schema: problemDetailSchema },
  },
});

const socialProviderParam = z.object({
  provider: z.enum(["github", "google"]).meta({
    description: "Social identity provider to sign in with.",
    example: "github",
  }),
});

const socialQueryParam = z.object({
  callbackURL: z.string().meta({
    description:
      "Absolute URL better-auth redirects to after the provider round-trip. Defaults to the configured FRONTEND_URL.",
    example: "http://localhost:3000/auth/callback",
  }),
});

export const authPaths = {
  "/api/v1/auth/providers": {
    get: {
      operationId: "getAuthProviders",
      summary: "List enabled sign-in methods",
      tags: ["Auth"],
      responses: {
        "200": {
          description: "Enabled providers for this instance.",
          content: {
            "application/json": { schema: authProvidersSchema },
          },
        },
      },
    },
  },
  "/api/v1/auth/social/{provider}": {
    get: {
      operationId: "socialSignIn",
      summary: "Start a social (OAuth) sign-in flow",
      description:
        "Responds with an HTTP 302 redirect to the provider's consent screen. Relays better-auth's `signInSocial`.",
      tags: ["Auth"],
      requestParams: {
        path: socialProviderParam,
        query: socialQueryParam.partial(),
      },
      responses: {
        "302": { description: "Redirect to the provider authorize URL." },
        "400": problemResponse(
          "Unsupported provider, provider not configured, or unable to start the flow.",
        ),
        "429": problemResponse("Throttled. Auth endpoints are rate limited."),
      },
    },
  },
  "/api/v1/auth/sign-up": {
    post: {
      operationId: "signUpWithEmail",
      summary: "Create an account with email and password",
      tags: ["Auth"],
      requestBody: {
        required: true,
        content: {
          "application/json": { schema: signUpSchema },
        },
      },
      responses: {
        "200": {
          description: "Account created; returns the session and user.",
          content: {
            "application/json": { schema: authResultSchema },
          },
        },
        "400": problemResponse("Validation failed (invalid email or short password)."),
        "429": problemResponse("Throttled. Auth endpoints are rate limited."),
        "500": problemResponse("Unexpected failure while creating the account."),
      },
    },
  },
  "/api/v1/auth/sign-in": {
    post: {
      operationId: "signInWithEmail",
      summary: "Sign in with email and password",
      tags: ["Auth"],
      requestBody: {
        required: true,
        content: {
          "application/json": { schema: signInSchema },
        },
      },
      responses: {
        "200": {
          description: "Authenticated; returns the session and user.",
          content: {
            "application/json": { schema: authResultSchema },
          },
        },
        "400": problemResponse("Validation failed."),
        "401": problemResponse("Invalid email or password."),
        "429": problemResponse("Throttled. Auth endpoints are rate limited."),
      },
    },
  },
  "/api/v1/auth/sign-out": {
    post: {
      operationId: "signOut",
      summary: "End the current session",
      description:
        "Accepts the session token as a Bearer token or via cookies. Best effort: always clears cookies and local state.",
      tags: ["Auth"],
      responses: {
        "200": {
          description: "Session terminated.",
          content: {
            "application/json": { schema: signOutResultSchema },
          },
        },
      },
    },
  },
  "/api/v1/auth/session": {
    get: {
      operationId: "getSession",
      summary: "Resolve the current session",
      description: "Returns the active session and user, or `null` when unauthenticated.",
      tags: ["Auth"],
      responses: {
        "200": {
          description: "Current session, or `null`.",
          content: {
            "application/json": {
              schema: authSessionResponseSchema.nullable(),
            },
          },
        },
      },
    },
  },
};
