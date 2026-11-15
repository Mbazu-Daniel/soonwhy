import { describe, expect, it, vi } from "vitest";
import { generateStructured } from "./structured-output";

const rejected = (status: number) => Object.assign(new Error("provider error"), { statusCode: status });

describe("generateStructured", () => {
  it("uses the strict schema when the provider accepts it", async () => {
    const run = vi.fn().mockResolvedValue("ok");

    await expect(generateStructured(run)).resolves.toBe("ok");
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(false);
  });

  it("retries once with the schema in the prompt when the provider answers 400", async () => {
    const run = vi.fn().mockRejectedValueOnce(rejected(400)).mockResolvedValueOnce("ok");

    await expect(generateStructured(run)).resolves.toBe("ok");
    expect(run.mock.calls).toEqual([[false], [true]]);
  });

  it("finds a 400 wrapped inside a cause", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error("wrapped"), { cause: { status: 400 } }))
      .mockResolvedValueOnce("ok");

    await expect(generateStructured(run)).resolves.toBe("ok");
  });

  it("does not retry other failures", async () => {
    for (const status of [401, 429, 500]) {
      const run = vi.fn().mockRejectedValue(rejected(status));
      await expect(generateStructured(run)).rejects.toMatchObject({ statusCode: status });
      expect(run).toHaveBeenCalledTimes(1);
    }
  });

  it("surfaces the second failure when the prompt fallback also fails", async () => {
    const run = vi.fn().mockRejectedValueOnce(rejected(400)).mockRejectedValueOnce(rejected(400));

    await expect(generateStructured(run)).rejects.toMatchObject({ statusCode: 400 });
    expect(run).toHaveBeenCalledTimes(2);
  });
});
