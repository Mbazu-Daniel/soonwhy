function httpStatusOf(error: unknown): number | undefined {
  let current: unknown = error;
  while (current && typeof current === "object") {
    const candidate = current as { statusCode?: unknown; status?: unknown; cause?: unknown };
    for (const value of [candidate.statusCode, candidate.status]) {
      if (typeof value === "number" && value >= 100 && value <= 599) return value;
    }
    current = candidate.cause;
  }
  return undefined;
}

export async function generateStructured<T>(
  run: (jsonPromptInjection: boolean) => Promise<T>,
): Promise<T> {
  try {
    return await run(false);
  } catch (error) {
    if (httpStatusOf(error) !== 400) throw error;
    return run(true);
  }
}
