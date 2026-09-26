import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface ProjectContextValue {
  projectId: string | null;
  projectSlug: string | null;
  orgId: string | null;
  setProjectId: (id: string) => void;
  setProject: (project: Project) => void;
  clearProjectId: () => void;
  orgSlug: string | null;
  setOrgId: (id: string) => void;
  setOrganization: (org: { id: string; slug: string }) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectIdState] = useState<string | null>(
    () => typeof window !== 'undefined' ? localStorage.getItem('project_id') : null,
  );
  const [projectSlug, setProjectSlugState] = useState<string | null>(
    () => typeof window !== 'undefined' ? localStorage.getItem('project_slug') : null,
  );
  const [orgId, setOrgIdState] = useState<string | null>(
    () => typeof window !== 'undefined' ? localStorage.getItem('org_id') : null,
  );
  const [orgSlug, setOrgSlugState] = useState<string | null>(
    () => typeof window !== 'undefined' ? localStorage.getItem('org_slug') : null,
  );

  const setProjectId = useCallback((id: string) => {
    localStorage.setItem('project_id', id);
    localStorage.removeItem('project_slug');
    setProjectIdState(id);
    setProjectSlugState(null);
  }, []);

  const setProject = useCallback((project: Project) => {
    localStorage.setItem('project_id', project.id);
    localStorage.setItem('project_slug', project.slug);
    setProjectIdState(project.id);
    setProjectSlugState(project.slug);
  }, []);

  const clearProjectId = useCallback(() => {
    localStorage.removeItem('project_id');
    localStorage.removeItem('project_slug');
    setProjectIdState(null);
    setProjectSlugState(null);
  }, []);

  const setOrgId = useCallback((id: string) => {
    localStorage.setItem('org_id', id);
    setOrgIdState(id);
  }, []);

  const setOrganization = useCallback((org: { id: string; slug: string }) => {
    const organizationChanged = org.id !== orgId;

    localStorage.setItem('org_id', org.id);
    localStorage.setItem('org_slug', org.slug);
    setOrgIdState(org.id);
    setOrgSlugState(org.slug);

    if (organizationChanged) {
      localStorage.removeItem('project_id');
      localStorage.removeItem('project_slug');
      setProjectIdState(null);
      setProjectSlugState(null);
    }
  }, [orgId]);

  return (
    <ProjectContext.Provider value={{ projectId, projectSlug, orgId, orgSlug, setProjectId, setProject, clearProjectId, setOrgId, setOrganization }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
