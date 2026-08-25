# 15: Authorization & RBAC

**What to build:** A document defining roles and permission matrix.

**Blocked by:** 14 (needs authentication design)

**Status:** done

- [x] Roles: Owner, Admin, Member, Viewer
- [x] Permission matrix:
  | Action | Owner | Admin | Member | Viewer |
  |--------|-------|-------|--------|--------|
  | Manage billing | Yes | No | No | No |
  | Manage org settings | Yes | Yes | No | No |
  | Manage projects | Yes | Yes | Yes | No |
  | View dashboard | Yes | Yes | Yes | Yes |
  | Manage API keys | Yes | Yes | No | No |
- [x] Role assignment and inheritance
- [x] Permission checking middleware
- [x] Organization vs project-level permissions

**Output:** `docs/architecture/authorization.md`
