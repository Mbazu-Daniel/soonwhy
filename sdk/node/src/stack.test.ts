import { describe, expect, it } from "vitest";
import { formatErrorStack } from "./stack.js";
import { toErrorLog } from "./otlp.js";

describe("formatErrorStack", () => {
  it("appends the cause chain", () => {
    const root = new Error("connection refused");
    const top = new Error("query failed", { cause: root });
    const stack = formatErrorStack(top);
    expect(stack).toContain("Error: query failed");
    expect(stack).toContain("Caused by: Error: connection refused");
  });

  it("stops on circular causes", () => {
    const a = new Error("a");
    const b = new Error("b", { cause: a });
    a.cause = b;
    expect(formatErrorStack(a).match(/Caused by/g)).toHaveLength(1);
  });

  it("is used for the exception.stacktrace attribute", () => {
    const log = toErrorLog({ error: new Error("top", { cause: new Error("root") }) });
    expect(String(log.attributes?.["exception.stacktrace"])).toContain("Caused by: Error: root");
  });
});

describe("formatErrorStack budget", () => {
  function deep(label: string, frames: number, cause?: Error) {
    const error = new Error(label, cause ? { cause } : undefined);
    error.stack = `Error: ${label}\n${Array.from({ length: frames }, (_, i) => `    at ${label}Fn${i} (/srv/app/src/${label}-${i}.ts:${i}:1)`).join("\n")}`;
    return error;
  }

  it("keeps the root cause when the chain is too long for one stack", () => {
    const stack = formatErrorStack(deep("top", 40, deep("mid", 40, deep("root", 40))));
    expect(stack.length).toBeLessThanOrEqual(4000);
    expect(stack).toContain("Caused by: Error: mid");
    expect(stack).toContain("Caused by: Error: root");
    expect(stack).toContain("rootFn0");
  });

  it("cuts only whole lines", () => {
    const stack = formatErrorStack(deep("top", 80, deep("root", 80)));
    for (const line of stack.split("\n")) expect(line).toMatch(/^(Error: |Caused by: |    at )/);
  });

  it("gives a short error its full text and the surplus to long ones", () => {
    const stack = formatErrorStack(deep("top", 5, deep("root", 200)));
    expect(stack).toContain("topFn4");
    expect(stack).toContain("rootFn0");
  });

  it("leaves a stack under budget untouched", () => {
    const error = deep("top", 3);
    expect(formatErrorStack(error)).toBe(error.stack);
  });
});
