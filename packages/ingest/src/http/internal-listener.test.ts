import { describe, expect, it } from "vitest";
import { internalPortFrom, isInternalRequest } from "./internal-listener";

describe("internalPortFrom", () => {
  it("is off unless a valid port is set", () => {
    expect(internalPortFrom(undefined, 3002)).toBeUndefined();
    expect(internalPortFrom("", 3002)).toBeUndefined();
    expect(internalPortFrom("abc", 3002)).toBeUndefined();
    expect(internalPortFrom("0", 3002)).toBeUndefined();
    expect(internalPortFrom("70000", 3002)).toBeUndefined();
  });

  it("refuses the public port so the trusted route can never be public", () => {
    expect(internalPortFrom("3002", 3002)).toBeUndefined();
  });

  it("accepts a different port", () => {
    expect(internalPortFrom("3003", 3002)).toBe(3003);
  });
});

describe("isInternalRequest", () => {
  const request = (localPort: number) => ({ socket: { localPort } }) as never;

  it("matches only requests that arrived on the internal port", () => {
    expect(isInternalRequest(request(3003), 3003)).toBe(true);
    expect(isInternalRequest(request(3002), 3003)).toBe(false);
  });

  it("is never true when the internal port is off", () => {
    expect(isInternalRequest(request(3003), undefined)).toBe(false);
  });
});
