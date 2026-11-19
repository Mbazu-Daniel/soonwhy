export type Signal = "logs" | "metrics";

export interface TelemetryTransport {
  send(signal: Signal, payload: Record<string, unknown>): Promise<boolean>;
}
