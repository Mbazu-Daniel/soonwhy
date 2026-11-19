import { describe, expect, it } from "vitest";
import { fetchTraceException, pickTraceException } from "./trace-exception";
import type { SpanErrorSource } from "./error.types";

const span = (extra: Partial<SpanErrorSource>): SpanErrorSource => ({ spanId: "s1", ...extra });

describe("pickTraceException", () => {
  it("returns the first span that recorded an exception", () => {
    const result = pickTraceException([
      span({ name: "request" }),
      span({ spanId: "s2", name: "handler /sign-in/email", exceptionType: "APIError", exceptionMessage: "Invalid email or password" }),
    ]);
    expect(result).toEqual({
      type: "APIError",
      message: "Invalid email or password",
      stacktrace: "",
      spanName: "handler /sign-in/email",
      spanId: "s2",
    });
  });

  it("returns null when no span has an exception", () => {
    expect(pickTraceException([span({ name: "request" })])).toBeNull();
  });
});

describe("fetchTraceException", () => {
  const scope = { orgId: "o", projectId: "p" };

  it("skips the lookup without a trace id", async () => {
    const quickwit = { search: () => Promise.reject(new Error("unused")) };
    expect(await fetchTraceException(quickwit as never, scope, "")).toBeNull();
  });

  it("returns null when the search fails", async () => {
    const quickwit = { search: () => Promise.reject(new Error("down")) };
    expect(await fetchTraceException(quickwit as never, scope, "t1")).toBeNull();
  });
});
