import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Clock, Calendar, Bell, Mail } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Skeleton } from '~/components/ui/skeleton';
import { QueryErrorState } from '~/components/query-error-state';
import { api } from '~/lib/api';
import { toast } from 'sonner';

export const Route = createFileRoute('/public/status/$orgId/$projectId')({
  component: PublicStatusPage,
});

interface ServiceStatus {
  id: number;
  name: string;
  url: string;
  status: string;
  uptimePercent: number;
  totalChecks: number;
  failedChecks: number;
  lastCheckAt: string | null;
  incidents: Array<{
    start: string;
    end: string;
    duration: number;
  }>;
}

interface StatusPageData {
  overallStatus: string;
  services: ServiceStatus[];
  lastUpdated: string;
}

function PublicStatusPage() {
  const { orgId, projectId } = Route.useParams();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [showSubscribe, setShowSubscribe] = useState(false);

  const status = useQuery({
    queryKey: ['public-status', orgId, projectId],
    queryFn: () => api.get<StatusPageData>(`/public/status/${orgId}/${projectId}`),
    refetchInterval: 60000,
  });

  const subscribe = useMutation({
    mutationFn: (data: { email: string }) =>
      api.post(`/public/status/${orgId}/${projectId}/subscriptions`, data),
    onSuccess: () => {
      toast.success('Subscribed to status updates');
      setEmail('');
      setShowSubscribe(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (status.isError) return <QueryErrorState onRetry={() => void status.refetch()} />;

  const data = status.data;

  const overallStatusColor =
    data?.overallStatus === 'up'
      ? 'text-[#16931F]'
      : data?.overallStatus === 'down'
      ? 'text-[#F2555A]'
      : 'text-[#F2C66D]';

  const overallStatusIcon =
    data?.overallStatus === 'up' ? (
      <CheckCircle className="h-6 w-6" />
    ) : data?.overallStatus === 'down' ? (
      <XCircle className="h-6 w-6" />
    ) : (
      <AlertCircle className="h-6 w-6" />
    );

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">System Status</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Real-time status of all services
          </p>
        </div>

        {status.isLoading ? (
          <Card className="shadow-none">
            <CardContent className="p-8">
              <Skeleton className="h-24 w-full" />
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="mb-8 shadow-none">
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={overallStatusColor}>{overallStatusIcon}</div>
                    <div>
                      <p className="text-2xl font-semibold capitalize">
                        {data?.overallStatus === 'up' ? 'All Systems Operational' : data?.overallStatus === 'down' ? 'System Outage' : 'Degraded Performance'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Last updated: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Services</h2>
              {data?.services.map((service) => (
                <Card key={service.id} className="shadow-none">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-3 w-3 rounded-full ${
                              service.status === 'up'
                                ? 'bg-[#16931F]'
                                : service.status === 'down'
                                ? 'bg-[#F2555A]'
                                : 'bg-[#F2C66D]'
                            }`}
                          />
                          <h3 className="text-lg font-medium">{service.name}</h3>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{service.url}</p>
                        <div className="mt-4 flex items-center gap-6 text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Uptime:</span>
                            <span
                              className={
                                service.uptimePercent >= 99
                                  ? 'text-[#16931F]'
                                  : service.uptimePercent >= 95
                                  ? 'text-[#F2C66D]'
                                  : 'text-[#F2555A]'
                              }
                            >
                              {service.uptimePercent}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Checks:</span>
                            <span>{service.totalChecks}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Last check:</span>
                            <span>
                              {service.lastCheckAt
                                ? new Date(service.lastCheckAt).toLocaleString()
                                : 'Never'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4">
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                            service.status === 'up'
                              ? 'bg-[#16931F]/10 text-[#16931F]'
                              : service.status === 'down'
                              ? 'bg-[#F2555A]/10 text-[#F2555A]'
                              : 'bg-[#F2C66D]/10 text-[#F2C66D]'
                          }`}
                        >
                          {service.status.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {service.incidents.length > 0 && (
                      <div className="mt-4 border-t border-border pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="h-4 w-4 text-[#F2555A]" />
                          <p className="text-sm font-medium text-[#F2555A]">Recent Incidents</p>
                        </div>
                        <div className="space-y-2">
                          {service.incidents.map((incident, i) => (
                            <div
                              key={i}
                              className="rounded-lg border border-[#F2555A]/30 bg-[#F2555A]/5 p-3 text-sm"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">
                                  {new Date(incident.start).toLocaleString()} -{' '}
                                  {new Date(incident.end).toLocaleString()}
                                </span>
                                <span className="font-medium">{incident.duration} min</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8 text-center text-sm text-muted-foreground">
              <p>Powered by Soonwhy</p>
              <p className="mt-1">
                This page updates automatically every minute. Last check:{' '}
                {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'Unknown'}
              </p>
            </div>

            <Card className="mt-8 shadow-none">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Get notified about incidents</p>
                      <p className="text-xs text-muted-foreground">Subscribe to receive email alerts when services go down</p>
                    </div>
                  </div>
                  {!showSubscribe ? (
                    <Button variant="outline" size="sm" onClick={() => setShowSubscribe(true)}>
                      Subscribe
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-64"
                      />
                      <Button
                        size="sm"
                        onClick={() => subscribe.mutate({ email })}
                        disabled={subscribe.isPending || !email}
                      >
                        {subscribe.isPending ? 'Subscribing...' : 'Subscribe'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowSubscribe(false)}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
