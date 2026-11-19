const MAX_MESSAGE_LENGTH = 240;
const SECRET_LIKE = /[A-Za-z0-9_-]{24,}/g;

function messageFromBody(body: unknown): string | undefined {
  if (typeof body !== "string") return undefined;
  try {
    const parsed = JSON.parse(body) as { error?: { message?: unknown }; message?: unknown };
    const message = parsed.error?.message ?? parsed.message;
    return typeof message === "string" ? message : undefined;
  } catch {
    return undefined;
  }
}

export function providerMessageOf(error: unknown): string | undefined {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const candidate = current as {
      responseBody?: unknown;
      data?: { error?: { message?: unknown } };
      message?: unknown;
      cause?: unknown;
    };
    const fromData = candidate.data?.error?.message;
    const raw =
      (typeof fromData === "string" ? fromData : undefined) ??
      messageFromBody(candidate.responseBody);
    if (raw) return clean(raw);
    current = candidate.cause;
  }
  return error instanceof Error && error.message ? clean(error.message) : undefined;
}

function clean(message: string): string {
  const flat = message.replace(/\s+/g, " ").replace(SECRET_LIKE, "…").trim();
  return flat.length > MAX_MESSAGE_LENGTH ? `${flat.slice(0, MAX_MESSAGE_LENGTH)}…` : flat;
}
