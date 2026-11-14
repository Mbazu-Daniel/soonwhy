export function selfObservabilityEnabled(): boolean {
  return process.env.SELF_OBSERVABILITY_ENABLED === "true";
}
