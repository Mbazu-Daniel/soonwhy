import { createFileRoute, Link, Outlet, useMatchRoute } from '@tanstack/react-router';
import { ShieldCheck, FileSearch } from 'lucide-react';
import { cn } from '~/lib/utils';

export const Route = createFileRoute('/$organizationSlug/p/$projectSlug/intelligence')({ component: IntelligenceLayout });

const tabs = [
  { to: '/$organizationSlug/p/$projectSlug/intelligence/findings', label: 'Findings', icon: FileSearch },
  { to: '/$organizationSlug/p/$projectSlug/intelligence/investigations', label: 'Investigations', icon: ShieldCheck },
] as const;

function IntelligenceLayout() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const matchRoute = useMatchRoute();

  return (
    <div className="flex min-h-full w-full flex-col gap-4 pb-8">
      <nav className="-mx-4 flex items-center gap-1 overflow-x-auto border-b border-border px-4 sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8" aria-label="Intelligence sections">
        {tabs.map((tab) => {
          const active = matchRoute({ to: tab.to, params: { organizationSlug, projectSlug }, fuzzy: false }) !== false;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              params={{ organizationSlug, projectSlug }}
              aria-current={active ? 'page' : undefined}
              className={cn(
                '-mb-px inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                active
                  ? 'border-[#8BD125] text-[#16931F]'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              <tab.icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div className="min-h-0 flex-1"><Outlet /></div>
    </div>
  );
}
