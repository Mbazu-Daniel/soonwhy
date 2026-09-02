import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent } from '~/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';

export const Route = createFileRoute('/dashboard/services')({
  component: ServiceOverview,
});

function ServiceOverview() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Services</h2>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Request Rate</TableHead>
                <TableHead className="text-right">Error Rate</TableHead>
                <TableHead className="text-right">P95 Latency</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No services found
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
