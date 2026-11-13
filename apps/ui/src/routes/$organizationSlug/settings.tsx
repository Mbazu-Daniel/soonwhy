import { createFileRoute } from '@tanstack/react-router';
import { Building2, FolderKanban, Users, UserRound } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { useProject } from '~/lib/project-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '~/lib/api';
import { OrganizationSection } from '~/components/settings/organization-section';
import { MembersSection } from '~/components/settings/members-section';
import { ProjectsSection } from '~/components/settings/projects-section';
import { ProfileSection } from '~/components/settings/profile-section';

export const Route = createFileRoute('/$organizationSlug/settings')({
  component: SettingsPage,
});

interface Project {
  id: string;
}

function SettingsPage() {
  const { orgId } = useProject();

  const projects = useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => api.get<Project[]>('/projects'),
    enabled: !!orgId,
  });

  const members = useQuery({
    queryKey: ['organization-members', orgId],
    queryFn: () => api.get<unknown[]>(`/organization/${encodeURIComponent(orgId ?? '')}/members`),
    enabled: !!orgId,
  });

  const tabTriggerClass =
    'flex-1 justify-center gap-2 rounded-md px-3 py-2 text-[#989898] transition-colors hover:text-[#F6F6F6] data-[state=active]:bg-[#242426] data-[state=active]:text-[#F6F6F6] data-[state=active]:shadow-none';

  return (
    <div className="w-full space-y-6 pb-10">
      <h1 className="sr-only">Settings</h1>

      <Tabs defaultValue="organization" className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-lg border border-[#242426] bg-[#151517] p-1">
          <TabsTrigger value="organization" className={tabTriggerClass}>
            <Building2 className="h-4 w-4" />Organization
          </TabsTrigger>
          <TabsTrigger value="members" className={tabTriggerClass}>
            <Users className="h-4 w-4" />Members
            {members.data && <span className="rounded-full bg-[#242426] px-2 py-0.5 text-xs font-medium text-[#989898]">{members.data.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="projects" className={tabTriggerClass}>
            <FolderKanban className="h-4 w-4" />Projects
            {projects.data && <span className="rounded-full bg-[#242426] px-2 py-0.5 text-xs font-medium text-[#989898]">{projects.data.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="profile" className={tabTriggerClass}>
            <UserRound className="h-4 w-4" />Profile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="organization" className="focus-visible:ring-0">
          <OrganizationSection />
        </TabsContent>
        <TabsContent value="members" className="focus-visible:ring-0">
          <MembersSection />
        </TabsContent>
        <TabsContent value="projects" className="focus-visible:ring-0">
          <ProjectsSection />
        </TabsContent>
        <TabsContent value="profile" className="focus-visible:ring-0">
          <ProfileSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
