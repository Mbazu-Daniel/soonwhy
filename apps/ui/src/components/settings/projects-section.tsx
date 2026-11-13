import { FormEvent, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '~/lib/api';
import { useProject } from '~/lib/project-context';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { QueryErrorState } from '~/components/query-error-state';
import { CreateProjectDialog } from '~/components/create-project-dialog';
import { ConfirmDeleteDialog } from '~/components/confirm-delete-dialog';
import { useSettingsMemberContext } from './organization-section';

interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export function ProjectsSection() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { orgId, orgSlug, projectId, clearProjectId } = useProject();
  const { canManage } = useSettingsMemberContext(orgId);

  const projects = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => api.get<Project[]>('/projects'),
    enabled: !!orgId,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);

  const saveProject = useMutation({
    mutationFn: (input: { id: string; name: string; description: string }) =>
      api.put<Project>(`/projects/${encodeURIComponent(input.id)}`, { name: input.name, description: input.description || undefined }),
    onSuccess: () => {
      setEditProject(null);
      void queryClient.invalidateQueries({ queryKey: ['projects', orgId] });
      toast.success('Project updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeProject = useMutation({
    mutationFn: (project: Project) => api.delete(`/projects/${encodeURIComponent(project.id)}`),
    onSuccess: async (_data, project) => {
      setDeleteProject(null);
      if (project.id === projectId) clearProjectId();
      await queryClient.invalidateQueries({ queryKey: ['projects', orgId] });
      toast.success(`Project “${project.name}” deleted`);
      if (orgSlug) {
        void navigate({ to: '/$organizationSlug', params: { organizationSlug: orgSlug } });
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function openEdit(project: Project) {
    setEditProject(project);
    setEditName(project.name);
    setEditDescription(project.description ?? '');
  }

  function submitEdit(event: FormEvent) {
    event.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed || !editProject) return;
    saveProject.mutate({ id: editProject.id, name: trimmed, description: editDescription.trim() });
  }

  return (
    <div className="w-full">
      <Card className="border-[#242426] bg-[#0B0B0C] shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2 text-base">
            <span className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-[#ACFC15]" />Projects
              {projects.data && <span className="rounded-full bg-[#151517] px-2 py-0.5 text-xs font-medium text-[#989898]">{projects.data.length}</span>}
            </span>
            {canManage && (
              <Button size="sm" variant="outline" className="h-8 border-[#242426] bg-[#151517] text-[#F6F6F6] hover:bg-[#1A1A1C]" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />New project
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {projects.isLoading ? (
            <div className="p-5 text-sm text-[#989898]">Loading projects…</div>
          ) : projects.isError ? (
            <div className="p-5"><QueryErrorState onRetry={() => void projects.refetch()} /></div>
          ) : !projects.data?.length ? (
            <div className="p-6 text-center text-sm text-[#989898]">No projects yet.{canManage && ' Create the first one to start ingesting telemetry.'}</div>
          ) : (
            <div className="divide-y divide-[#242426]">
              {projects.data.map((project) => {
                const current = project.id === projectId;
                const openProject = () => orgSlug && navigate({ to: '/$organizationSlug/p/$projectSlug', params: { organizationSlug: orgSlug, projectSlug: project.slug } });
                return (
                  <div
                    key={project.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${project.name}`}
                    onClick={openProject}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openProject();
                      }
                    }}
                    className="flex cursor-pointer items-center gap-3 p-4 text-left transition-colors hover:bg-[#151517] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ACFC15]"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#151517] text-xs font-semibold text-[#ACFC15]">{project.name.charAt(0).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{project.name}</span>
                      <span className="block truncate font-mono text-xs text-[#6E6E70]">{project.slug}</span>
                      {project.description && <span className="block truncate text-xs text-[#989898]">{project.description}</span>}
                    </span>
                    {current && <Badge variant="outline" className="border-[#3A3A3C] text-[#ACFC15]">Current</Badge>}
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${project.name}`}
                        className="text-[#989898] hover:text-[#F6F6F6]"
                        onClick={(event) => { event.stopPropagation(); openEdit(project); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${project.name}`}
                        className="text-red-400 hover:bg-red-950/40 hover:text-red-300"
                        onClick={(event) => { event.stopPropagation(); setDeleteProject(project); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />

      <Dialog open={!!editProject} onOpenChange={(open) => { if (!open) setEditProject(null); }}>
        <DialogContent className="border-[#242426] bg-[#141414] text-[#F6F6F6]">
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription className="text-[#989898]">
              Rename <span className="font-mono text-[#C9C9CB]">{editProject?.slug}</span>. The slug cannot change.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-project-name">Name</Label>
              <Input id="edit-project-name" value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={100} required autoFocus className="border-[#242426] bg-[#151517]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-description">Description <span className="text-[#6E6E70]">(optional)</span></Label>
              <Input id="edit-project-description" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={500} placeholder="What does this project track?" className="border-[#242426] bg-[#151517]" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="border-[#242426] bg-[#151517]" onClick={() => setEditProject(null)} disabled={saveProject.isPending}>Cancel</Button>
              <Button type="submit" disabled={!editName.trim() || saveProject.isPending}>
                {saveProject.isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {deleteProject && (
        <ConfirmDeleteDialog
          open={!!deleteProject}
          onOpenChange={(open) => { if (!open) setDeleteProject(null); }}
          title="Delete project"
          description="Deletes telemetry, alerts and settings. This cannot be undone."
          confirmationText={deleteProject.slug}
          confirmLabel="Delete project"
          pending={removeProject.isPending}
          error={removeProject.isError ? (removeProject.error as Error).message : null}
          onConfirm={() => removeProject.mutate(deleteProject)}
        />
      )}
    </div>
  );
}
