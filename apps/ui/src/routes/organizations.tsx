import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useProject } from '~/lib/project-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Card, CardContent } from '~/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Skeleton } from '~/components/ui/skeleton';
import { api } from '~/lib/api';
import { QueryErrorState } from '~/components/query-error-state';

export const Route = createFileRoute('/organizations')({
  component: Organizations,
});

interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

function CreateOrgDialog() {
  const navigate = useNavigate();
  const { setOrgId, clearProjectId } = useProject();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');

  const createOrg = useMutation({
    mutationFn: (data: { name: string; slug: string }) =>
      api.post<Organization>('/organizations', data),
    onSuccess: (org) => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setOrgId(org.id);
      setOpen(false);
      setName('');
      setSlug('');
      navigate({ to: '/onboarding' });
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    createOrg.mutate({ name, slug: slug || name.toLowerCase().replace(/\s+/g, '-') });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Create Organization</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Organization</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="My Organization"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={1}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              placeholder="my-organization (auto-generated if empty)"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              pattern="[a-z0-9-]+"
            />
          </div>
          <Button type="submit" className="w-full" disabled={createOrg.isPending}>
            {createOrg.isPending ? 'Creating...' : 'Create'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Organizations() {
  const navigate = useNavigate();
  const { setOrgId } = useProject();

  const { data: orgs, isLoading, isError, refetch } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => api.get<Organization[]>('/organizations'),
  });

  function selectOrg(org: Organization) {
    setOrgId(org.id);
    clearProjectId();
    navigate({ to: '/onboarding' });
  }

  if (isError) return <QueryErrorState onRetry={() => void refetch()} />;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Choose your workspace</h1>
          <p className="text-muted-foreground mt-2">
            Select an organization to continue setup, or create a new workspace.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : orgs && orgs.length > 0 ? (
          <>
            <div className="space-y-4">
              {orgs.map((org) => (
                <Card
                  key={org.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => selectOrg(org)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectOrg(org); } }}
                  role="button"
                  tabIndex={0}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{org.name}</h3>
                      <p className="text-sm text-muted-foreground">{org.slug}</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      Select
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-6 text-center">
              <CreateOrgDialog />
            </div>
          </>
        ) : (
          <Card className="text-center py-12">
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">No organizations yet</p>
              <CreateOrgDialog />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
