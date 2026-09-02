import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent } from '~/components/ui/card';

export const Route = createFileRoute('/dashboard/errors')({
  component: ErrorOverview,
});

function ErrorOverview() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Errors</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Errors</p><p className="text-2xl font-bold mt-1">—</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">New</p><p className="text-2xl font-bold mt-1">—</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Ongoing</p><p className="text-2xl font-bold mt-1">—</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Resolved</p><p className="text-2xl font-bold mt-1">—</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-8 text-center text-muted-foreground text-sm">
          No errors found
        </CardContent>
      </Card>
    </div>
  );
}
