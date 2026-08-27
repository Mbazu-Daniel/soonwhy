import { Button } from '~/components/ui/button';

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div className="text-sm text-muted-foreground">
        {/* Org/project switcher will go here */}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm">
          Docs
        </Button>
        <Button variant="outline" size="sm">
          Sign out
        </Button>
      </div>
    </header>
  );
}
