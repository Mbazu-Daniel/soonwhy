import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ProjectContextValue {
  projectId: string | null;
  orgId: string | null;
  setProjectId: (id: string) => void;
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
  const [orgId, setOrgIdState] = useState<string | null>(
    () => typeof window !== 'undefined' ? localStorage.getItem('org_id') : null,
  );
  const [orgSlug, setOrgSlugState] = useState<string | null>(
    () => typeof window !== 'undefined' ? localStorage.getItem('org_slug') : null,
  );

  const setProjectId = useCallback((id: string) => {
    localStorage.setItem('project_id', id);
    setProjectIdState(id);
  }, []);

  const clearProjectId = useCallback(() => {
    localStorage.removeItem('project_id');
    setProjectIdState(null);
  }, []);

  const setOrgId = useCallback((id: string) => {
    localStorage.setItem('org_id', id);
    setOrgIdState(id);
  }, []);

  const setOrganization = useCallback((org: { id: string; slug: string }) => {
    localStorage.setItem('org_id', org.id);
    localStorage.setItem('org_slug', org.slug);
    setOrgIdState(org.id);
    setOrgSlugState(org.slug);
  }, []);

  return (
    <ProjectContext.Provider value={{ projectId, orgId, orgSlug, setProjectId, clearProjectId, setOrgId, setOrganization }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
