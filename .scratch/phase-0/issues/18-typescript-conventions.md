# 18: TypeScript Conventions

**What to build:** A document defining TypeScript coding standards across the project.

**Blocked by:** None (can start immediately)

 **Status: done**

- [x] Strict mode enabled
- [x] Naming conventions:
  - camelCase for variables and functions
  - PascalCase for types, interfaces, classes, components
  - snake_case for database columns
  - UPPER_SNAKE_CASE for constants
- [x] File organization (feature-based or layer-based)
- [x] Import ordering (external → internal → relative)
- [x] Type vs interface (interface for shapes, type for unions)
- [x] Explicit return types on public functions
- [x] No `any` (use `unknown` and narrow)
- [x] Linting rules (oxlint configuration)

**Output:** `docs/engineering/typescript-conventions.md`
