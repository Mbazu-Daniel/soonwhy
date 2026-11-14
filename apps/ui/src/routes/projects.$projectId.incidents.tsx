import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { api } from '~/lib/api';

export const Route = createFileRoute('/projects/$projectId/incidents')({
  component: IncidentsPage,
});

interface Incident {
  id: number;
  incidentId: string;
  alertRuleId: string;
  status: 'firing' | 'acknowledged' | 'resolved';
  severity: string;
  title: string;
  body: string;
  firedAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  acknowledgementNote?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  recoveryNotified: boolean;
}

interface IncidentStats {
  total: number;
  firing: number;
  acknowledged: number;
  resolved: number;
}

function IncidentsPage() {
  const { projectId } = Route.useParams();

  const incidents = useQuery({
    queryKey: ['incidents', projectId],
    queryFn: () => api.get<Incident[]>(`/projects/${projectId}/incidents`),
    refetchInterval: 30000,
  });

  const stats = useQuery({
    queryKey: ['incident-stats', projectId],
    queryFn: () => api.get<IncidentStats>(`/projects/${projectId}/incidents/stats`),
    refetchInterval: 30000,
  });

  const handleAcknowledge = async (id: number, note?: string) => {
    await api.post(`/projects/${projectId}/incidents/${id}/acknowledge`, {
      acknowledgedBy: 'current-user',
      note,
    });
    void incidents.refetch();
    void stats.refetch();
  };

  const handleResolve = async (id: number, note?: string) => {
    await api.post(`/projects/${projectId}/incidents/${id}/resolve`, {
      resolvedBy: 'current-user',
      note,
    });
    void incidents.refetch();
    void stats.refetch();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'firing':
        return (
          <Badge className="bg-[#F2555A]/10 text-[#F2555A] border-[#F2555A]">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Firing
          </Badge>
        );
      case 'acknowledged':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500">
            <Clock className="h-3 w-3 mr-1" />
            Acknowledged
          </Badge>
        );
      case 'resolved':
        return (
          <Badge className="bg-[#16931F]/10 text-[#16931F] border-[#16931F]">
            <CheckCircle className="h-3 w-3 mr-1" />
            Resolved
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-500/10 text-red-500 border-red-500',
      high: 'bg-orange-500/10 text-orange-500 border-orange-500',
      medium: 'bg-yellow-500/10 text-yellow-500 border-yellow-500',
      low: 'bg-blue-500/10 text-blue-500 border-blue-500',
      info: 'bg-gray-500/10 text-gray-500 border-gray-500',
    };
    const color = colors[severity] || colors.info;
    return <Badge className={color}>{severity}</Badge>;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Incidents</h1>
          <p className="text-xs text-[#989898]">Track and manage alert incidents</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            void incidents.refetch();
            void stats.refetch();
          }}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="shadow-none">
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold">{stats.data?.total || 0}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground">Firing</p>
            <p className="text-2xl font-semibold text-[#F2555A]">{stats.data?.firing || 0}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground">Acknowledged</p>
            <p className="text-2xl font-semibold text-yellow-500">{stats.data?.acknowledged || 0}</p>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="p-6">
            <p className="text-xs text-muted-foreground">Resolved</p>
            <p className="text-2xl font-semibold text-[#16931F]">{stats.data?.resolved || 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none">
        <CardContent className="p-6">
          {incidents.data && incidents.data.length > 0 ? (
            <div className="space-y-4">
              {incidents.data.map((incident) => (
                <div
                  key={incident.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(incident.status)}
                        {getSeverityBadge(incident.severity)}
                      </div>
                      <h3 className="font-medium">{incident.title}</h3>
                      <p className="text-sm text-muted-foreground">{incident.body}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Fired: {new Date(incident.firedAt).toLocaleString()}</span>
                        {incident.acknowledgedAt && (
                          <span>
                            Acknowledged: {new Date(incident.acknowledgedAt).toLocaleString()} by {incident.acknowledgedBy}
                          </span>
                        )}
                        {incident.acknowledgementNote && (
                          <span className="text-yellow-600">Note: {incident.acknowledgementNote}</span>
                        )}
                        {incident.resolvedAt && (
                          <span>Resolved: {new Date(incident.resolvedAt).toLocaleString()} by {incident.resolvedBy}</span>
                        )}
                        {incident.resolutionNote && (
                          <span className="text-green-600">Resolution: {incident.resolutionNote}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {incident.status === 'firing' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAcknowledge(incident.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Acknowledge
                        </Button>
                      )}
                      {(incident.status === 'firing' || incident.status === 'acknowledged') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResolve(incident.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              No incidents found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
