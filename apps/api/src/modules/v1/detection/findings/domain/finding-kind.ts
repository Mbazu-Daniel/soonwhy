import type { FindingCategory } from "../../../../../common/db/schema/finding-lifecycle";
import { FINDING_KINDS } from "./finding-kinds.constants";

export function categoryOf(type: string): FindingCategory {
  return FINDING_KINDS[type as keyof typeof FINDING_KINDS]?.category ?? "performance";
}

const CLIENT_ERROR_ADVICE: Record<string, string> = {
  "401": "A 401 is usually an expired or missing session, not a defect. Ignore it unless it spikes or hits an endpoint that should never reject callers; then check how tokens are issued and refreshed.",
  "403": "A 403 is usually a user without permission for that action, not a defect. Ignore it unless it spikes or hits users who should have access; then check the role or policy that denied it.",
  "404": "A 404 is usually a stale link, a bot, or a client calling a missing route. Ignore it unless it spikes or a real page or endpoint is affected; then check what changed in the routes or links.",
  "429": "A 429 means a rate limit was hit. Ignore it for one-off bursts; if it repeats for normal users, check the limit against real traffic and find which client is sending the bursts.",
};
const GENERIC_CLIENT_ERROR_ADVICE =
  "A 4xx is usually a client mistake or an expected rejection, not a server defect. Ignore it unless the count grows or users report breakage; then check whether a client or a deploy changed the request.";

function clientErrorAdvice(title: string): string | null {
  const status = /\bHTTP (4\d\d)\b/.exec(title)?.[1];
  return status === undefined ? null : (CLIENT_ERROR_ADVICE[status] ?? GENERIC_CLIENT_ERROR_ADVICE);
}

export function recommendationFor(type: string, title = ""): string | null {
  if (type === "error_group") {
    const advice = clientErrorAdvice(title);
    if (advice !== null) return advice;
  }
  return FINDING_KINDS[type as keyof typeof FINDING_KINDS]?.recommendation ?? null;
}
