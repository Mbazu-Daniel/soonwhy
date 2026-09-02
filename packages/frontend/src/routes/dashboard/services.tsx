import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Skeleton } from '~/components/ui/skeleton';
import { Button } from '~/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table';
import { Activity, AlertTriangle, Clock } from 'lucide-react';

export const Route = createFileRoute('/dashboard/services')({
  component: ServiceOverview,
});

interface Service {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  requestRate: number;
  errorRate: number;
  latencyP95: number;
}

const MOCK_SERVICES: Service[] = [
  { id: '1', name: 'api-gateway', status: 'healthy', requestRate: 42.3, errorRate: 0.1, latencyP95: 120 },
  { id: '2', name: 'auth-service', status: 'healthy', requestRate: 12.1, errorRate: 0.0, latencyP95: 45 },
  { id: '3', name: 'payment-service', status: 'degraded', requestRate: 8.7, errorRate: 2.3, latencyP95: 890 },
  { id: '4', name: 'notification-service', status: 'healthy', requestRate: 5.2, errorRate: 0.0, latencyP95: 30 },
  { id: '5', name: 'data-processor', status: 'unhealthy', requestRate: 0.5, errorRate: 15.0, latencyP95: 2100 },
];

function StatusBadge({ status }: { status: Service['status'] }) {
  const variants = {
    healthy: 'bg-green-500/10 text-green-500 border-green-500/20',
    degraded: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    unhealthy: 'bg-destructive/10 text-destructive border-destructive/20',
  };

  return (
    <Badge variant="outline" className={variants[status]}>
      {status}
    </Badge>
  );
}

function ServiceOverview() {
  // Mock data — real data comes from ClickHouse queries in Phase 4
  const services = MOCK_SERVICES;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Services</h2>
        <p className="text-muted-foreground">Per-service health and performance</p>
      </div>

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
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell>
                    <StatusBadge status={service.status} />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {service.requestRate.toFixed(1)}/s
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    <span className={service.errorRate > 1 ? 'text-destructive' : ''}>
                      {service.errorRate.toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {service.latencyP95}ms
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">3</p>
              <p className="text-sm text-muted-foreground">Healthy</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">1</p>
              <p className="text-sm text-muted-foreground">Degraded</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">1</p>
              <p className="text-sm text-muted-foreground">Unhealthy</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
