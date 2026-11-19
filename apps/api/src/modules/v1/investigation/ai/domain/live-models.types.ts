export type LiveModelsFailure = "key_rejected" | "unreachable" | "bad_response";

export interface LiveModelsRequest {
  endpoint: string;
  apiKey: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

export class LiveModelsError extends Error {
  constructor(
    readonly failure: LiveModelsFailure,
    readonly status: number | null = null,
  ) {
    super(failure);
    this.name = "LiveModelsError";
  }
}
