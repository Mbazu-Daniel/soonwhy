export interface DependencyReportOptions {
  apiEndpoint: string;
  apiKey: string;
  serviceName: string;
  fetch: typeof globalThis.fetch;
  timeoutMs: number;
  root?: string;
  includeDev?: boolean;
}
