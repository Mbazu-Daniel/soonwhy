import { Button } from '~/components/ui/button';
import { CommandPalette } from '~/components/command-palette';
import { Menu } from 'lucide-react';
import { useSidebar } from '~/lib/sidebar-context';

export function TopBar() {
  const { toggle } = useSidebar();

  return (
    <header className="flex min-h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-3 py-2 sm:px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={toggle} aria-label="Toggle sidebar">
        <Menu className="h-5 w-5" />
      </Button>
      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <CommandPalette />
      </div>
    </header>
  );
}
