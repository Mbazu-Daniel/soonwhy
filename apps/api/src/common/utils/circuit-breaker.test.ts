import { describe, expect, it, vi } from "vitest";
import { CircuitBreaker } from "./circuit-breaker";

describe("CircuitBreaker", () => {
  it("executes function when closed", async () => {
    const breaker = new CircuitBreaker();
    const fn = vi.fn().mockResolvedValue("success");

    const result = await breaker.execute(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(breaker.getState()).toBe("closed");
  });

  it("opens after failure threshold", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3 });
    const fn = vi.fn().mockRejectedValue(new Error("error"));

    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(fn);
      } catch {}
    }

    expect(breaker.getState()).toBe("open");
  });

  it("rejects when open", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 1000 });
    const fn = vi.fn().mockRejectedValue(new Error("error"));

    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(fn);
      } catch {}
    }

    await expect(breaker.execute(fn)).rejects.toThrow("Circuit breaker is OPEN");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("transitions to half-open after reset timeout", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeoutMs: 100 });
    const fn = vi.fn().mockRejectedValue(new Error("error"));

    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(fn);
      } catch {}
    }

    await new Promise((resolve) => setTimeout(resolve, 150));

    fn.mockResolvedValue("success");
    const result = await breaker.execute(fn);

    expect(result).toBe("success");
    expect(breaker.getState()).toBe("half-open");
  });

  it("closes after success threshold in half-open", async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      successThreshold: 2,
      resetTimeoutMs: 100,
    });
    const fn = vi.fn().mockResolvedValue("success");

    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(fn);
      } catch {}
    }

    await new Promise((resolve) => setTimeout(resolve, 150));

    await breaker.execute(fn);
    await breaker.execute(fn);

    expect(breaker.getState()).toBe("closed");
  });

  it("calls onStateChange callback", async () => {
    const onStateChange = vi.fn();
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      onStateChange,
    });
    const fn = vi.fn().mockRejectedValue(new Error("error"));

    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(fn);
      } catch {}
    }

    expect(onStateChange).toHaveBeenCalledWith("open");
  });

  it("resets to closed state", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 2 });
    const fn = vi.fn().mockRejectedValue(new Error("error"));

    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(fn);
      } catch {}
    }

    breaker.reset();

    expect(breaker.getState()).toBe("closed");
    expect(breaker.getFailureCount()).toBe(0);
  });
});
