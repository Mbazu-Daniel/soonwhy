# React Conventions

## Principles

- Functional components only — no class components.
- Keep components small and focused; extract logic into custom hooks.
- Prefer composition over configuration.
- Components are reusable units; pages are route-specific compositions.
- Accessibility is not optional — WCAG 2.1 AA compliance is baseline.

---

## Component Organization

### Feature-based structure

```
packages/frontend/app/
├── routes/                # TanStack Router file-based routes
│   ├── __root.tsx
│   └── index.tsx
├── components/            # Shared UI components
│   ├── ui/                # shadcn/ui primitives
│   │   ├── Button.tsx
│   │   └── Card.tsx
│   └── shared/            # App-specific shared components
│       ├── MetricCard.tsx
│       └── EmptyState.tsx
├── features/              # Feature-specific components and logic
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── useAuth.ts
│   │   └── auth.types.ts
│   └── projects/
│       ├── ProjectCard.tsx
│       ├── ProjectList.tsx
│       ├── useProjects.ts
│       └── projects.types.ts
├── lib/                   # Shared utilities and hooks
│   ├── utils.ts
│   └── useToast.ts
├── styles/
│   └── globals.css
└── types/
    └── index.ts
```

### What goes where

| Location | Contents |
|----------|----------|
| `components/ui/` | shadcn/ui primitives — do not edit directly |
| `components/shared/` | Reusable app-specific components |
| `features/<name>/` | Feature-scoped components, hooks, and types |
| `lib/` | Truly cross-cutting utilities |
| `types/` | Shared type definitions across features |

---

## Component Patterns

### Functional components only

```tsx
// ✅ Good — functional component
function MetricCard({ title, value, trend }: MetricCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p>{value}</p>
        <TrendBadge trend={trend} />
      </CardContent>
    </Card>
  );
}

// ❌ Bad — class component
class MetricCard extends React.Component<MetricCardProps> { ... }
```

### Props interface naming

Define props as an interface, named `{ComponentName}Props`:

```tsx
interface MetricCardProps {
  title: string;
  value: number;
  trend: "up" | "down" | "neutral";
}

function MetricCard({ title, value, trend }: MetricCardProps) { ... }
```

Inline types are acceptable for simple, single-use components:

```tsx
function StatusBadge({ status }: { status: "active" | "inactive" }) {
  return <span className={statusClasses[status]}>{status}</span>;
}
```

### Exports

- **Pages/routes**: Default exports (TanStack Router convention).
- **Components**: Named exports.
- **Hooks**: Named exports.

```tsx
// Page — default export
export default function DashboardPage() { ... }

// Component — named export
export function MetricCard({ ... }: MetricCardProps) { ... }

// Hook — named export
export function useProjects() { ... }
```

---

## Hooks Conventions

### Custom hooks

- Prefix with `use`.
- Extract side effects, derived state, and reusable logic into hooks.
- Keep components as thin rendering shells.

```tsx
// ✅ Good — hook handles logic
function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => fetchProjects(),
  });
}

function ProjectList() {
  const { data: projects, isLoading, error } = useProjects();

  if (isLoading) return <ProjectListSkeleton />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <ul>
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </ul>
  );
}

// ❌ Bad — logic in component
function ProjectList() {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, []);

  // ... rendering
}
```

### Rules of hooks

- Only call hooks at the top level — never inside loops, conditions, or nested functions.
- Only call hooks from React functions — components or custom hooks.
- Follow the exhaustive-deps rule for `useEffect` and `useMemo`.

---

## State Management

### Local state for UI state

Use `useState` or `useReducer` for component-scoped UI state:

```tsx
function SearchFilter() {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date">("name");

  // ...
}
```

Use `useReducer` for complex state with multiple transitions:

```tsx
type FormState =
  | { status: "idle" }
  | { status: "submitting"; values: FormValues }
  | { status: "success"; data: Response }
  | { status: "error"; error: string };

function useFormSubmit() {
  return useReducer(formReducer, { status: "idle" as const });
}
```

### TanStack Query for server state

All server data flows through TanStack Query. Never fetch in `useEffect` — use queries and mutations:

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Query
function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Mutation
function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
```

### Query key conventions

```ts
// List queries
["projects"]
["projects", { status: "active" }]

// Detail queries
["projects", projectId]

// Related data
["projects", projectId, "members"]
```

### No global state libraries

Do not add Redux, Zustand, Jotai, or similar. TanStack Query covers server state; local state covers UI state. If you think you need global state, extract a custom hook with `useState`/`useReducer` and pass it down via context if needed.

---

## Form Handling

### Use React Hook Form + Zod

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const CreateProjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  environment: z.enum(["development", "staging", "production"]),
});

type CreateProjectForm = z.infer<typeof CreateProjectSchema>;

function CreateProjectForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectForm>({
    resolver: zodResolver(CreateProjectSchema),
  });

  const mutation = useCreateProject();

  function onSubmit(data: CreateProjectForm) {
    mutation.mutate(data);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FormField>
        <FormLabel htmlFor="name">Name</FormLabel>
        <Input id="name" {...register("name")} />
        {errors.name && <FormMessage>{errors.name.message}</FormMessage>}
      </FormField>
      {/* ... */}
      <Button type="submit" disabled={isSubmitting}>
        Create
      </Button>
    </form>
  );
}
```

### Form rules

- Define validation schemas with Zod; derive TypeScript types from them.
- Always show validation errors inline — never use `alert()`.
- Disable submit button while submitting to prevent double-submits.
- Reset form state on successful submission.
- Preserve form state on navigation if the user might lose progress.

---

## Error Boundaries

### Route-level errors

TanStack Router provides built-in error handling via `errorComponent`:

```tsx
export const Route = createFileRoute("/dashboard")({
  errorComponent: DashboardError,
});

function DashboardError({ error }: ErrorComponentProps) {
  return (
    <div role="alert">
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <Button onClick={() => window.location.reload()}>Try again</Button>
    </div>
  );
}
```

### Component-level errors

For component-level failures (e.g., a widget that shouldn't take down the page), use a generic error boundary:

```tsx
interface ErrorBoundaryProps {
  fallback: React.ComponentType<{ error: Error; reset: () => void }>;
  children: React.ReactNode;
}

function ErrorBoundary({ fallback: Fallback, children }: ErrorBoundaryProps) {
  return (
    <React.Suspense fallback={<Spinner />}>
      <ErrorBoundaryImpl fallback={Fallback}>
        {children}
      </ErrorBoundaryImpl>
    </React.Suspense>
  );
}
```

### Error handling rules

- Every route must have an `errorComponent`.
- Never swallow errors silently — log them and show user-facing feedback.
- Provide a recovery action (retry, go home, contact support).
- Never expose stack traces or internal error details in production.

---

## Loading States

### Always provide loading feedback

```tsx
function ProjectList() {
  const { data, isLoading, isFetching, error } = useProjects();

  if (isLoading) return <ProjectListSkeleton />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      {isFetching && <ProgressBar />}
      <ul>
        {data.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </ul>
    </div>
  );
}
```

### Skeleton patterns

- Match the skeleton shape to the actual content layout.
- Use Tailwind `animate-pulse` for the shimmer effect.
- Colocate skeleton components with the components they represent.

```tsx
function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-12 mt-2" />
      </CardContent>
    </Card>
  );
}
```

### Loading state conventions

| State | UI Treatment |
|-------|-------------|
| Initial load | Skeleton matching content shape |
| Background refetch | Subtle progress indicator (bar or spinner) |
| Mutation in progress | Disable interactive elements, show inline feedback |
| Empty state | Illustration + message + action |

---

## Accessibility (WCAG 2.1 AA)

### Semantic HTML

Use the correct HTML elements — do not reach for `<div>` when a semantic element exists:

```tsx
// ✅ Good
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/dashboard">Dashboard</a></li>
    <li><a href="/projects">Projects</a></li>
  </ul>
</nav>

// ❌ Bad
<div className="nav">
  <div className="nav-item">Dashboard</div>
  <div className="nav-item">Projects</div>
</div>
```

### Interactive elements

- Every interactive element must be keyboard accessible.
- Use `<button>` for actions, `<a>` for navigation — never `<div onClick>`.
- Provide visible focus indicators.

```tsx
// ✅ Good
<button onClick={handleDelete} aria-label="Delete project">
  <TrashIcon />
</button>

// ❌ Bad
<div onClick={handleDelete} className="cursor-pointer">
  <TrashIcon />
</div>
```

### ARIA patterns

- Use `aria-label` or `aria-labelledby` for elements without visible text.
- Use `aria-live` regions for dynamic content updates.
- Use `role` attributes when semantic HTML is insufficient.

```tsx
<div aria-live="polite" aria-atomic="true">
  {toast && <Toast message={toast.message} />}
</div>
```

### Color and contrast

- Text must meet 4.5:1 contrast ratio against its background.
- Never convey information through color alone — use icons, text, or patterns.
- Use Tailwind's color palette which has been designed with accessibility in mind.

### Accessibility checklist

- [ ] All images have `alt` text (decorative images use `alt=""`)
- [ ] Form inputs have associated `<label>` elements
- [ ] Error messages are associated with their inputs via `aria-describedby`
- [ ] Focus is managed correctly on route changes and modal open/close
- [ ] Skip-to-content link is present on every page
- [ ] Color contrast meets WCAG 2.1 AA requirements
- [ ] All interactive elements are keyboard navigable

---

## Performance Optimization

### Lazy loading

Use `lazy()` for route components and heavy feature modules:

```tsx
import { lazy } from "react";

const DashboardPage = lazy(() => import("~/features/dashboard/DashboardPage"));
const AdminPanel = lazy(() => import("~/features/admin/AdminPanel"));
```

Wrap lazy components with `Suspense` at the route level:

```tsx
import { Suspense } from "react";

function App() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
```

### Memoization

Use `React.memo` sparingly — only when:
- A component renders frequently with the same props.
- The child is expensive to render.

```tsx
const ProjectCard = React.memo(function ProjectCard({
  project,
}: ProjectCardProps) {
  return (
    <Card>
      <CardTitle>{project.name}</CardTitle>
      {/* ... */}
    </Card>
  );
});
```

Use `useMemo` for expensive computations:

```tsx
const sortedProjects = useMemo(
  () => projects.sort((a, b) => a.name.localeCompare(b.name)),
  [projects]
);
```

Use `useCallback` for callbacks passed to memoized children:

```tsx
const handleDelete = useCallback(
  (id: string) => deleteProject(id),
  [deleteProject]
);
```

### Performance rules

- Do not memoize everything — it adds overhead. Profile first.
- Avoid creating new objects/arrays in render — use `useMemo`.
- Keep component state local to where it's needed.
- Prefer `key`-based list rendering over index-based.

---

## Tailwind CSS Conventions

### Design tokens

Use Tailwind's utility classes consistently. Do not use arbitrary values when a utility exists:

```tsx
// ✅ Good — uses design tokens
<div className="p-4 text-sm font-medium text-gray-700">

// ❌ Bad — arbitrary values
<div className="p-[16px] text-[14px] font-medium text-[#374151]">
```

### Class ordering

Follow Tailwind's recommended class order:

1. Layout (display, position, flex, grid)
2. Box model (width, height, padding, margin)
3. Typography (font, text, leading)
4. Visual (background, border, shadow)
5. Interactive (cursor, transition, animation)

```tsx
// ✅ Good — logical ordering
<div className="flex items-center p-4 text-sm font-medium bg-white rounded-lg shadow-sm hover:shadow-md">

// ❌ Bad — random ordering
<div className="bg-white p-4 rounded-lg flex text-sm shadow-sm hover:shadow-md font-medium items-center">
```

### Responsive design

Use mobile-first responsive prefixes:

```tsx
// Mobile first — base is mobile
<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
```

### Conditional classes

Use `cn()` from `lib/utils.ts` for conditional class merging:

```tsx
import { cn } from "~/lib/utils";

function Badge({ variant, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
        variant === "success" && "bg-green-100 text-green-700",
        variant === "error" && "bg-red-100 text-red-700",
        variant === "warning" && "bg-yellow-100 text-yellow-700",
        className
      )}
    >
      {children}
    </span>
  );
}
```

### Tailwind rules

- No inline `style` attributes — use Tailwind classes.
- No custom CSS files unless Tailwind cannot express the style.
- Use `cn()` for all conditional class logic.
- Extract repeated patterns into components, not CSS classes.

---

## shadcn/ui Component Usage

### Importing

Import from the `~/components/ui` path:

```tsx
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
```

### Extending with variants

Use `cva` (class-variance-authority) to extend shadcn/ui components with custom variants:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);
```

### Rules

- Never modify files in `~/components/ui/` directly — they are managed by shadcn/ui CLI.
- Create wrapper components in `~/components/shared/` when you need app-specific behavior.
- Use the `cn()` utility to merge Tailwind classes.

---

## Quick Reference

| Do | Don't |
|----|-------|
| Functional components | Class components |
| Named exports for components | Default exports for components (except pages) |
| `ComponentNameProps` interface | Inline prop types (except simple cases) |
| TanStack Query for server state | `useEffect` + `useState` for fetching |
| React Hook Form + Zod for forms | Uncontrolled forms without validation |
| Skeleton loading states | Blank screens while loading |
| Semantic HTML elements | `<div>` for everything |
| Keyboard-accessible interactions | Mouse-only interactions |
| `cn()` for conditional classes | Template literals for class names |
| Lazy-load heavy routes | Bundle everything upfront |
| `React.memo` when measured | Memoize every component |
