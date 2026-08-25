# Authorization & RBAC

## Overview

Authorization is layered on top of Better Auth authentication (see [authentication.md](./authentication.md)). Every authenticated request — session or API key — must pass through RBAC checks before accessing resources.

Roles are hierarchical: higher roles inherit all permissions of lower roles. Permissions are checked at three resource levels: organization, project, and environment.

---

## Role Hierarchy

```
Owner
 └─ Admin
     └─ Member
         └─ Viewer
```

| Role | Description |
|------|-------------|
| **Owner** | Full control. Can manage billing, delete the org, and assign any role. Only one Owner per org at a time (transfer required to change). |
| **Admin** | Operational control. Manages settings, projects, members, and API keys. Cannot manage billing or delete the org. |
| **Member** | Day-to-day contributor. Creates and edits projects, environments, and telemetry. Cannot manage org settings, members, or API keys. |
| **Viewer** | Read-only access. Can view dashboards, query telemetry, and read project settings. Cannot create, update, or delete anything. |

---

## Permission Matrix

### Organization-Level Permissions

| Action | Owner | Admin | Member | Viewer |
|--------|:-----:|:-----:|:------:|:------:|
| View org dashboard | ✓ | ✓ | ✓ | ✓ |
| Edit org name/settings | ✓ | ✓ | — | — |
| Delete organization | ✓ | — | — | — |
| Manage billing | ✓ | — | — | — |
| Invite members | ✓ | ✓ | — | — |
| Remove members | ✓ | ✓ | — | — |
| Change member roles | ✓ | ✓* | — | — |
| Create API keys | ✓ | ✓ | — | — |
| Revoke API keys | ✓ | ✓ | — | — |
| View audit log | ✓ | ✓ | ✓ | ✓ |

\* Admins cannot assign the Owner role or promote to Owner.

### Project-Level Permissions

| Action | Owner | Admin | Member | Viewer |
|--------|:-----:|:-----:|:------:|:------:|
| View project | ✓ | ✓ | ✓ | ✓ |
| Create project | ✓ | ✓ | ✓ | — |
| Edit project settings | ✓ | ✓ | ✓ | — |
| Delete project | ✓ | ✓ | — | — |
| Manage project environments | ✓ | ✓ | ✓ | — |
| View project telemetry | ✓ | ✓ | ✓ | ✓ |
| Query telemetry (API) | ✓ | ✓ | ✓ | ✓ |

### Environment-Level Permissions

| Action | Owner | Admin | Member | Viewer |
|--------|:-----:|:-----:|:------:|:------:|
| View environment | ✓ | ✓ | ✓ | ✓ |
| Create environment | ✓ | ✓ | ✓ | — |
| Edit environment settings | ✓ | ✓ | ✓ | — |
| Delete environment | ✓ | ✓ | — | — |
| View environment variables | ✓ | ✓ | ✓ | — |
| Edit environment variables | ✓ | ✓ | ✓ | — |
| View telemetry data | ✓ | ✓ | ✓ | ✓ |

---

## API Key Permissions

API keys are scoped to a specific organization, project, and environment. They authenticate programmatic access (SDK, CI/CD) and do not carry user role attributes.

### Scopes

API keys use a fine-grained scope system. Each scope follows the pattern `resource:action`.

| Scope | Grants |
|-------|--------|
| `telemetry:read` | Query and read telemetry data |
| `telemetry:write` | Ingest telemetry events |
| `projects:read` | List and view projects |
| `projects:write` | Create, update, delete projects |
| `environments:read` | List and view environments |
| `environments:write` | Create, update, delete environments |
| `api-keys:read` | List API keys (metadata only, never raw values) |
| `api-keys:write` | Create and revoke API keys |
| `org:read` | View org settings and membership |

### Scope Enforcement

1. Key is looked up by prefix → verified by SHA-256 hash.
2. The key's `scopes` array is checked against the endpoint's required scope.
3. The key's `org_id` is injected into request context.
4. If the endpoint requires a project or environment, the key's scoped `project_id` and `environment_id` must match the request's target resource.

### Creating an API Key

```http
POST /api/v1/api-keys
Authorization: Bearer <session_token>

{
  "name": "CI/CD Pipeline",
  "project_id": "proj_abc123",
  "environment_id": "env_def456",
  "scopes": ["telemetry:write", "projects:read"],
  "expires_at": "2026-12-31T00:00:00Z"
}
```

Key format: `sw_<8-char-prefix><44-char-random>`. The raw key is returned **once** on creation.

---

## Resource Hierarchy and Inheritance

Permissions follow a strict hierarchy:

```
Organization
 └─ Project
     └─ Environment
```

- **Org-level** permissions (billing, member management, API keys) apply across all projects and environments within the org.
- **Project-level** permissions apply to all environments within that project.
- **Environment-level** permissions are the most granular and do not escalate upward.

A Member who can edit a project can edit any environment within it — but cannot delete the project itself (Admin+ required).

---

## Middleware Implementation

All authorization checks happen in NestJS middleware/guards. The flow:

```
Request
  │
  ▼
Authentication Guard ──── extracts user/org from JWT or API key
  │
  ▼
RBAC Guard ───────────── checks role + scope against endpoint requirements
  │
  ▼
Resource Guard ────────── verifies resource belongs to the org in request context
  │
  ▼
Controller
```

### 1. Authentication Guard

Extracts identity from the `Authorization` header:

- **JWT session:** Decodes the token, verifies RS256 signature and expiry. Attaches `{ user_id, org_id, role }` to request context.
- **API key:** Looks up by prefix, verifies SHA-256 hash. Attaches `{ api_key_id, org_id, scopes, project_id?, environment_id? }` to request context.

### 2. RBAC Guard

A decorator-based guard applied to controller methods:

```typescript
// Example: require Admin role
@RequireRole('admin')
@Post('projects')
createProject(@Body() dto: CreateProjectDto) { ... }

// Example: require specific scope (API key only)
@RequireScope('telemetry:write')
@Post('telemetry/ingest')
ingestTelemetry(@Body() payload: TelemetryPayload) { ... }
```

The guard compares the request's role (or scopes) against the endpoint's requirement. If insufficient, returns `403 Forbidden` with an `authorization-error` problem detail.

### 3. Resource Guard

Ensures the target resource belongs to the authenticated org:

```typescript
@UseGuards(ResourceGuard)
@Get('projects/:id')
getProject(@Param('id') id: string) { ... }
```

The guard queries the resource by ID, checks the `org_id` column matches the request's `org_id`, and returns `404 Not Found` if mismatched (never leaks existence).

---

## Permission Checking Patterns

### Pattern 1: Role-Based Endpoint Protection

For endpoints that apply uniformly to all resources in an org:

```typescript
@RequireRole('member')
@Get('projects')
listProjects() { ... }
```

### Pattern 2: Scope-Based API Key Protection

For programmatic endpoints where the key's scope determines access:

```typescript
@RequireScope('telemetry:write')
@Post('telemetry/ingest')
ingestTelemetry() { ... }
```

### Pattern 3: Resource-Level Ownership Check

For endpoints that operate on a specific resource and must verify org ownership:

```typescript
@RequireRole('admin')
@Delete('projects/:id')
@UseGuards(ResourceGuard)
deleteProject(@Param('id') id: string) { ... }
```

### Pattern 4: Conditional Permission Escalation

Some actions require higher privilege than the default role hierarchy. For example, deleting an org requires Owner only, not Admin:

```typescript
@RequireRole('owner')
@Delete('organizations/:id')
deleteOrganization(@Param('id') id: string) { ... }
```

### Pattern 5: Self-Service Role Restrictions

Members and Viewers cannot promote themselves. Role changes are restricted to Admin+:

```typescript
@RequireRole('admin')
@Patch('organizations/:orgId/members/:memberId/role')
changeRole(
  @Param('orgId') orgId: string,
  @Param('memberId') memberId: string,
  @Body('role') newRole: MemberRole,
) {
  // Admins cannot assign Owner
  if (newRole === 'owner') {
    throw new ForbiddenException('Only owners can transfer ownership');
  }
}
```

---

## Database-Level Enforcement (RLS)

Row-Level Security (RLS) in PostgreSQL (per ADR-0005) provides a second layer of defense. The auth middleware injects `org_id` into the database session, and RLS policies ensure queries only return data belonging to that org.

This means even if application-level RBAC has a bug, the database rejects cross-tenant queries.

---

## Endpoints Summary

| Endpoint | Method | Minimum Role | Required Scope |
|----------|--------|-------------|----------------|
| `POST /v1/organizations` | POST | Authenticated user | — |
| `PATCH /v1/organizations/:id` | PATCH | Admin | — |
| `DELETE /v1/organizations/:id` | DELETE | Owner | — |
| `GET /v1/organizations/:id/members` | GET | Member | — |
| `POST /v1/organizations/:id/members` | POST | Admin | — |
| `PATCH /v1/organizations/:id/members/:mid/role` | PATCH | Admin | — |
| `DELETE /v1/organizations/:id/members/:mid` | DELETE | Admin | — |
| `GET /v1/projects` | GET | Member | `projects:read` |
| `POST /v1/projects` | POST | Member | `projects:write` |
| `GET /v1/projects/:id` | GET | Member | `projects:read` |
| `PATCH /v1/projects/:id` | PATCH | Member | `projects:write` |
| `DELETE /v1/projects/:id` | DELETE | Admin | `projects:write` |
| `GET /v1/environments` | GET | Member | `environments:read` |
| `POST /v1/environments` | POST | Member | `environments:write` |
| `PATCH /v1/environments/:id` | PATCH | Member | `environments:write` |
| `DELETE /v1/environments/:id` | DELETE | Admin | `environments:write` |
| `POST /v1/telemetry/ingest` | POST | Member | `telemetry:write` |
| `GET /v1/telemetry/query` | GET | Viewer | `telemetry:read` |
| `POST /v1/api-keys` | POST | Admin | `api-keys:write` |
| `GET /v1/api-keys` | GET | Admin | `api-keys:read` |
| `DELETE /v1/api-keys/:id` | DELETE | Admin | `api-keys:write` |
| `GET /v1/audit-log` | GET | Member | — |
