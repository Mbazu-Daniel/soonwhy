import { MAX_LISTED_MODELS } from "./custom-provider.constants";
import { LiveModelsError, type LiveModelsRequest } from "./live-models.types";

function idsOf(payload: unknown): string[] {
  const data =
    typeof payload === "object" && payload !== null
      ? (payload as { data?: unknown }).data
      : undefined;
  if (!Array.isArray(data)) throw new LiveModelsError("bad_response");
  const ids = data.flatMap((entry) => {
    const id =
      typeof entry === "object" && entry !== null ? (entry as { id?: unknown }).id : undefined;
    return typeof id === "string" && id.trim() ? [id.trim()] : [];
  });
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b)).slice(0, MAX_LISTED_MODELS);
}

export async function listLiveModels(request: LiveModelsRequest): Promise<string[]> {
  const fetchImpl = request.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${request.endpoint.replace(/\/+$/, "")}/models`, {
      headers: request.apiKey ? { authorization: `Bearer ${request.apiKey}` } : {},
      signal: AbortSignal.timeout(request.timeoutMs),
    });
  } catch {
    throw new LiveModelsError("unreachable");
  }
  if (response.status === 401 || response.status === 403) {
    throw new LiveModelsError("key_rejected", response.status);
  }
  if (!response.ok) throw new LiveModelsError("bad_response", response.status);
  try {
    return idsOf(await response.json());
  } catch (error) {
    if (error instanceof LiveModelsError) throw error;
    throw new LiveModelsError("bad_response");
  }
}
