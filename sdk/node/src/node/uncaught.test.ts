import { describe, expect, it, vi } from "vitest";
import { UncaughtErrorHandlers } from "./uncaught.js";

describe("UncaughtErrorHandlers", () => {
  it("reports unhandled rejections and stops after removeAll", () => {
    const handlers = new UncaughtErrorHandlers();
    const sink = vi.fn();
    handlers.register(sink);
    const before = process.listenerCount("unhandledRejection");
    const reason = new Error("boom");
    process.emit("unhandledRejection", reason, Promise.resolve());
    expect(sink).toHaveBeenCalledWith(reason, "unhandledRejection");
    handlers.removeAll();
    expect(process.listenerCount("unhandledRejection")).toBe(before - 1);
  });
});
