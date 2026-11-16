import type { ErrorLogSource } from "./error.types";

export function inEnvironment(sources: ErrorLogSource[], environment?: string): ErrorLogSource[] {
  if (!environment) return sources;
  return sources.filter((source) => source.environment === environment);
}
