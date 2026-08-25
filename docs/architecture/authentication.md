# Authentication Design

## Overview

Authentication is handled by the API Service via Better Auth. Two authentication paths exist:

1. **Interactive auth** — email/password and OAuth for browser-based users
2. **Programmatic auth** — API keys for SDK/CI integrations

## Better Auth Integration

Better Auth is installed as a NestJS module in the API Service. It manages user accounts, sessions, and credential flows.

**Database:** PostgreSQL (shared with RLS per ADR-0005). Better Auth tables:

```
users
  id            uuid PK
  email         text UNIQUE NOT NULL
  name          text
  image         text
  email_verified boolean DEFAULT false
  created_at    timestamptz DEFAULT now()
  updated_at    timestamptz DEFAULT now()

accounts (OAuth + password credentials)
  id            uuid PK
  user_id       uuid FK → users.id ON DELETE CASCADE
  provider_id   text NOT NULL        -- 'email', 'github', 'google'
  provider_user_id text              -- email (for password), OAuth subject
  password_hash text                 -- bcrypt/argon2 hash, null for OAuth
  access_token  text                 -- OAuth token (nullable)
  refresh_token text                 -- OAuth token (nullable)
  created_at    timestamptz DEFAULT now()

sessions
  id            text PK (session token hash)
  user_id       uuid FK → users.id ON DELETE CASCADE
  ip_address    text
  user_agent    text
  expires_at    timestamptz NOT NULL
  created_at    timestamptz DEFAULT now()

organizations
  id            uuid PK
  name          text NOT NULL
  slug          text UNIQUE NOT NULL
  created_at    timestamptz DEFAULT now()

members (org membership)
  id            uuid PK
  user_id       uuid FK → users.id ON DELETE CASCADE
  org_id        uuid FK → organizations.id ON DELETE CASCADE
  role          text DEFAULT 'member' -- 'owner' | 'admin' | 'member'
  created_at    timestamptz DEFAULT now()

api_keys
  id            uuid PK
  org_id        uuid FK → organizations.id ON DELETE CASCADE
  name          text NOT NULL
  prefix         text NOT NULL        -- first 8 chars of raw key (for lookup/display)
  key_hash      text NOT NULL        -- SHA-256 hash of the full key
  scopes        text[] DEFAULT '{}'
  expires_at    timestamptz
  last_used_at  timestamptz
  created_at    timestamptz DEFAULT now()
```

## Email + Password Authentication

- **Hashing:** argon2id (preferred) or bcrypt with cost factor 12. argon2id chosen for memory-hardness resistance to GPU attacks.
- **Login:** `POST /api/v1/auth/sign-in` with `email` + `password`. Returns session token and refresh token.
- **Sign up:** `POST /api/v1/auth/sign-up` with `email` + `password` + `name`. Sends verification email. Account not usable until verified.
- **Password reset:** `POST /api/v1/auth/forgot-password` sends a time-limited reset link. `POST /api/v1/auth/reset-password` accepts `token` + `new_password`.
- **Rate limiting:** 5 failed login attempts per email per 15 minutes, then lockout for 15 minutes.

## OAuth Providers

### GitHub

- Client ID / Secret from environment variables.
- Scopes: `read:user`, `user:email`.
- Callback URL: `POST /api/v1/auth/callback/github`.
- On first login: create user, link account, set `email_verified = true`.

### Google

- Client ID / Secret from environment variables.
- Scopes: `openid`, `email`, `profile`.
- Callback URL: `POST /api/v1/auth/callback/google`.
- On first login: create user, link account, set `email_verified = true`.

### Account Linking

If an OAuth email matches an existing password account, the OAuth provider is linked to that account rather than creating a duplicate.

## Session Management

### Access Token (JWT)

- **Type:** Short-lived access token (JWT).
- **Expiry:** 15 minutes.
- **Payload:**
  ```json
  {
    "sub": "user-uuid",
    "org_id": "org-uuid",
    "role": "member",
    "iat": 1234567890,
    "exp": 1234568790
  }
  ```
- **Signing:** RS256 (asymmetric). Private key signs, public key verifies. Allows multiple services to verify without holding the private key.
- **Validation:** On every request, API verifies signature + expiry. No database lookup required.

### Refresh Token

- **Type:** Opaque token, stored server-side in PostgreSQL (sessions table).
- **Expiry:** 30 days.
- **Rotation:** On each refresh, a new refresh token is issued and the previous one invalidated (rotation). If a used refresh token is detected, all sessions for that user are revoked (token reuse detection).
- **Cookie:** HttpOnly, Secure, SameSite=Lax, path `/api/v1/auth`. Not accessible via JavaScript.

### Session Storage

Sessions stored in PostgreSQL (not Redis) to maintain consistency with RLS and avoid an extra dependency. Session table is indexed on `user_id` for fast lookup during logout-all.

## API Key Authentication

For SDK and programmatic access. No browser session involved.

### Creation

```http
POST /api/v1/api-keys
Content-Type: application/json

{
  "name": "CI/CD Key",
  "scopes": ["telemetry:write"],
  "expires_at": "2026-12-31T00:00:00Z"
}
```

Response includes the raw key **once**. The raw key is never stored; only the hash is saved.

### Key Format

```
sw_<8-char-prefix><44-char-random>
```

- `sw_` — prefix identifying Soonwhy keys.
- Next 8 characters — stored in `api_keys.prefix` for lookup and display (`sw_abc12...**`).
- Remaining 44 characters — random, hashed with SHA-256 before storage.

### Authentication Flow

1. SDK sends request with header: `Authorization: Bearer sw_abc12345...`
2. Extract prefix, look up `api_keys` by `(prefix, org_id)`.
3. Hash the full key, compare with `key_hash`.
4. If valid, attach `org_id` to request context.
5. Update `last_used_at`.

### Revocation

```http
DELETE /api/v1/api-keys/{id}
```

Immediate revocation. SDK must create a new key.

## Multi-Tenancy Integration

Auth integrates with the multi-tenancy model (ADR-0005):

- JWT contains `org_id` — all API requests scoped to one organization.
- API keys are bound to one `org_id` via foreign key.
- Org membership table controls which users can access which orgs.
- RLS policies in PostgreSQL enforce tenant isolation; auth middleware injects `org_id` into request context for query scoping.

## Logout and Session Invalidation

- **Logout:** `POST /api/v1/auth/sign-out`. Deletes the session record. Client clears the refresh token cookie.
- **Logout all:** `POST /api/v1/auth/sign-out-all`. Deletes all sessions for the user. Triggers re-authentication on all devices.

## Environment Variables

```
BETTER_AUTH_SECRET=           # Signing secret for Better Auth
JWT_PRIVATE_KEY=              # RS256 private key (PEM)
JWT_PUBLIC_KEY=               # RS256 public key (PEM)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
EMAIL_FROM=                   # e.g. noreply@soonwhy.dev
RESEND_API_KEY=               # For transactional email
```

## Endpoints Summary

```
# Email + Password
POST /api/v1/auth/sign-up
POST /api/v1/auth/sign-in
POST /api/v1/auth/sign-out
POST /api/v1/auth/sign-out-all
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
POST /api/v1/auth/verify-email

# OAuth
GET  /api/v1/auth/sign-in/github
POST /api/v1/auth/callback/github
GET  /api/v1/auth/sign-in/google
POST /api/v1/auth/callback/google

# API Keys
POST   /api/v1/api-keys
GET    /api/v1/api-keys
DELETE /api/v1/api-keys/{id}

# Session
GET    /api/v1/auth/session
POST   /api/v1/auth/refresh
```
