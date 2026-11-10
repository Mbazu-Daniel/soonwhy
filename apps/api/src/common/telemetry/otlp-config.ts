export type OtlpSignal = "traces" | "metrics";

export function resolveOtlpEndpoint(signal: OtlpSignal): string | null {
  const specific = process.env[
    `OTEL_EXPORTER_OTLP_${signal.toUpperCase()}_ENDPOINT`
  ];
  if (specific?.trim()) return specific.trim();
  const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/v1/${signal}`;
}

export function resolveOtlpHeaders(
  signal: OtlpSignal,
): Record<string, string> {
  const raw =
    process.env[`OTEL_EXPORTER_OTLP_${signal.toUpperCase()}_HEADERS`] ??
    process.env.OTEL_EXPORTER_OTLP_HEADERS ??
    "";
  return Object.fromEntries(
    raw.split(",").flatMap((entry) => {
      const separator = entry.indexOf("=");
      if (separator <= 0) return [];
      return [
        [
          entry.slice(0, separator).trim(),
          entry.slice(separator + 1).trim(),
        ] as const,
      ];
    }),
  );
}
