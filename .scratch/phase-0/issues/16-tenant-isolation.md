# 16: Tenant Isolation

**What to build:** A document defining multi-tenancy with Row-Level Security.

**Blocked by:** 15 (needs authorization design)

**Status:** done

- [x] Shared database strategy (all orgs in same PostgreSQL)
- [x] org_id column on all tables
- [x] Row-Level Security (RLS) policies
- [x] Tenant resolution middleware (API key → org_id)
- [x] Query filtering (every query includes WHERE org_id = ?)
- [x] ClickHouse tenant isolation (separate tables or filters)
- [x] Testing tenant isolation (cannot access other org's data)
- [x] Noisy neighbor mitigation

**Output:** `docs/architecture/tenant-isolation.md`
