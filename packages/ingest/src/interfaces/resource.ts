export interface ParsedResource {
  attributes: Record<string, unknown>;
  serviceName: string;
  serviceVersion: string;
  environment: string;
  region: string;
}
