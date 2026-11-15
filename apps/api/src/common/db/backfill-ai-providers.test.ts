import { describe, expect, it, vi } from "vitest";
import { backfillAiProviderLibrary } from "./backfill-ai-providers";

function client(state: { has_table: boolean; has_name: boolean }) {
  const tx = vi.fn().mockResolvedValue([]);
  const begin = vi.fn(async (run: (t: typeof tx) => Promise<void>) => run(tx));
  const sql = Object.assign(vi.fn().mockResolvedValue([state]), { begin });
  return { sql: sql as never, begin, tx };
}

describe("backfillAiProviderLibrary", () => {
  it("does nothing on a fresh database", async () => {
    const { sql, begin } = client({ has_table: false, has_name: false });
    expect(await backfillAiProviderLibrary(sql)).toBe(false);
    expect(begin).not.toHaveBeenCalled();
  });

  it("does nothing once the name column exists", async () => {
    const { sql, begin } = client({ has_table: true, has_name: true });
    expect(await backfillAiProviderLibrary(sql)).toBe(false);
    expect(begin).not.toHaveBeenCalled();
  });

  it("adds, fills and defaults the new columns for an existing table", async () => {
    const { sql, begin, tx } = client({ has_table: true, has_name: false });
    expect(await backfillAiProviderLibrary(sql)).toBe(true);
    expect(begin).toHaveBeenCalledTimes(1);
    expect(tx).toHaveBeenCalledTimes(4);
  });
});
