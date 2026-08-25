import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-4">Welcome to SoonWhy</h1>
        <p className="text-muted-foreground">
          TanStack Start + NestJS + shadcn/ui
        </p>
      </main>
    </div>
  );
}
