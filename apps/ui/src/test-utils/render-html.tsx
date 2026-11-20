import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export function newQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

export function renderHtml(element: ReactElement, client: QueryClient = newQueryClient()): string {
  const html = renderToString(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  return html.replace(/<!-- -->/g, '');
}
