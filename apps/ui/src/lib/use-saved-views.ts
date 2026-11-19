import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '~/lib/api';
import { sanitizeView, type LogViewState } from '~/lib/log-view';

interface SavedView {
  id: string;
  name: string;
  description?: string | null;
  query: unknown;
  updatedAt: string;
}

const base = (projectId: string) => `/projects/${projectId}/query-catalog/saved-queries`;

export function useSavedViews(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ['saved-log-views', projectId],
    queryFn: () => api.get<SavedView[]>(`${base(projectId!)}?dataType=logs`),
    enabled: !!projectId,
    retry: false,
  });
}

export function useSharedView(projectId: string | null | undefined, viewId: string | undefined) {
  return useQuery({
    queryKey: ['saved-log-view', projectId, viewId],
    queryFn: async () => {
      const saved = await api.get<SavedView>(`${base(projectId!)}/${encodeURIComponent(viewId!)}`);
      return { ...saved, view: sanitizeView(saved.query) };
    },
    enabled: !!projectId && !!viewId,
    retry: false,
  });
}

export function useSaveView(projectId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; view: LogViewState }) =>
      api.post<SavedView>(base(projectId!), { name: input.name, dataType: 'logs', query: input.view }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-log-views', projectId] }),
  });
}

export function useDeleteView(projectId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`${base(projectId!)}/${encodeURIComponent(id)}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-log-views', projectId] }),
  });
}
