# 15: Authorization & RBAC

**What to build:** A document defining roles and permission matrix.

**Blocked by:** 14 (needs authentication design)

**Status:** ready-for-agent

- [ ] Roles: Owner, Admin, Member, Viewer
- [ ] Permission matrix:
  | Action | Owner | Admin | Member | Viewer |
  |--------|-------|-------|--------|--------|
  | Manage billing | Yes | No | No | No |
  | Manage org settings | Yes | Yes | No | No |
  | Manage projects | Yes | Yes | Yes | No |
  | View dashboard | Yes | Yes | Yes | Yes |
  | Manage API keys | Yes | Yes | No | No |
- [ ] Role assignment and inheritance
- [ ] Permission checking middleware
- [ ] Organization vs project-level permissions

**Output:** `docs/architecture/authorization.md`
