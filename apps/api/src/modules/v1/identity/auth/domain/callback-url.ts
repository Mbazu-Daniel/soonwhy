const DEFAULT_FRONTEND = "http://localhost:3000";

function frontendOrigin(): string {
  const base = process.env.FRONTEND_URL || DEFAULT_FRONTEND;
  try {
    return new URL(base).origin;
  } catch {
    return DEFAULT_FRONTEND;
  }
}

export function safeCallbackUrl(candidate: string | undefined): string {
  const origin = frontendOrigin();
  const fallback = process.env.FRONTEND_URL || DEFAULT_FRONTEND;
  if (!candidate) return fallback;
  if (candidate.startsWith("/") && !candidate.startsWith("//") && !candidate.includes("\\")) {
    return `${origin}${candidate}`;
  }
  try {
    return new URL(candidate).origin === origin ? candidate : fallback;
  } catch {
    return fallback;
  }
}
