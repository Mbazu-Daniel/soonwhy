# 19: React Conventions

**What to build:** A document defining React component patterns and state management.

**Blocked by:** 18 (needs TypeScript conventions)

 **Status: done**

- [x] Component patterns:
  - Functional components only (no class components)
  - Props interface naming: `ComponentNameProps`
  - Default exports for pages, named exports for components
- [x] Hooks conventions:
  - Custom hooks prefix with `use`
  - Extract logic into hooks, keep components thin
- [x] State management:
  - Local state for UI state
  - TanStack Query for server state
  - No Redux/Zustand (keep it simple)
- [x] shadcn/ui usage:
  - Import from `@/components/ui`
  - Extend with custom variants, don't modify source
- [x] Tailwind conventions:
  - Use design tokens (colors, spacing)
  - No inline styles
  - Responsive design patterns

**Output:** `docs/engineering/react-conventions.md`
