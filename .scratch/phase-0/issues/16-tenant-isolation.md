# 16: Tenant Isolation

**What to build:** A document defining multi-tenancy with Row-Level Security.

**Blocked by:** 15 (needs authorization design)

**Status:** ready-for-agent

- [ ] Shared database strategy (all orgs in same PostgreSQL)
- [ ] org_id column on all tables
- [ ] Row-Level Security (RLS) policies
- [ ] Tenant resolution middleware (API key → org_id)
- [ ] Query filtering (every query includes WHERE org_id = ?)
- [ ] ClickHouse tenant isolation (separate tables or filters)
- [ ] Testing tenant isolation (cannot access other org's data)
- [ ] Noisy neighbor mitigation

**Output:** `docs/architecture/tenant-isolation.md`
