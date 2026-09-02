import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ProjectContextValue {
  projectId: string | null;
  orgId: string | null;
  envSlug: string | null;
  setProjectId: (id: string) => void;
  setOrgId: (id: string) => void;
  setEnvSlug: (slug: string) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectIdState] = useState<string | null>(
    () => typeof window !== 'undefined' ? localStorage.getItem('project_id') : null,
  );
  const [orgId, setOrgIdState] = useState<string | null>(
    () => typeof window !== 'undefined' ? localStorage.getItem('org_id') : null,
  );
  const [envSlug, setEnvSlugState] = useState<string | null>(
    () => typeof window !== 'undefined' ? localStorage.getItem('env_slug') : null,
  );

  const setProjectId = useCallback((id: string) => {
    localStorage.setItem('project_id', id);
    setProjectIdState(id);
  }, []);

  const setOrgId = useCallback((id: string) => {
    localStorage.setItem('org_id', id);
    setOrgIdState(id);
  }, []);

  const setEnvSlug = useCallback((slug: string) => {
    localStorage.setItem('env_slug', slug);
    setEnvSlugState(slug);
  }, []);

  return (
    <ProjectContext.Provider value={{ projectId, orgId, envSlug, setProjectId, setOrgId, setEnvSlug }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProject must be used within ProjectProvider');
  return ctx;
}
