import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FolderKanban } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';

interface Project { id: string; name: string; slug: string; }

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}

export function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { orgId, orgSlug, setProject } = useProject();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const createProject = useMutation({
    mutationFn: (input: { name: string; slug: string }) => api.post<Project>('/projects', input),
    onSuccess: async (project) => {
      setProject(project);
      await queryClient.invalidateQueries({ queryKey: ['projects', orgId] });
      setName('');
      setError('');
      onOpenChange(false);
      if (orgSlug) {
        void navigate({ to: '/$organizationSlug/p/$projectSlug/', params: { organizationSlug: orgSlug, projectSlug: project.slug } });
      }
    },
    onError: (err: Error) => setError(err.message),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const projectName = name.trim();
    const projectSlug = slugify(projectName);
    if (!projectName || !projectSlug) {
      setError('Enter a project name.');
      return;
    }
    setError('');
    createProject.mutate({ name: projectName, slug: projectSlug });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Create project</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary"><FolderKanban className="h-6 w-6" /></div>
          <div className="space-y-2"><Label htmlFor="first-project-name">Project name</Label><Input id="first-project-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Payments API" required maxLength={100} autoFocus /></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={createProject.isPending}><Plus className="h-4 w-4" />{createProject.isPending ? 'Creating...' : 'Create project'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
