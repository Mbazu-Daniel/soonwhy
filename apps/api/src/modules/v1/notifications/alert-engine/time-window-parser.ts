export const TimeWindowParser = {
  parse(window?: string): { start: Date; end: Date } | undefined {
    if (!window) return undefined;

    const now = new Date();
    const parts = window.split("/");
    const durationStr = parts[0]!.trim();
    const offsetStr = parts.length > 1 ? parts[1]!.trim() : "now";

    const durationMap: Record<string, number> = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
    };

    let durationMs = 1 * 60 * 60 * 1000;
    const durationMatch = durationStr.match(/^(\d+)(s|m|h|d)$/);
    if (durationMatch) {
      durationMs = parseInt(durationMatch[1]!) * (durationMap[durationMatch[2]!] ?? 3600000);
    }

    const end = now;
    const start = new Date(now.getTime() - durationMs);

    return { start, end };
  },
};
