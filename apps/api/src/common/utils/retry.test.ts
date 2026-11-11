import { describe, expect, it, vi } from "vitest";
import { withRetry, isRetryableError, isNonRetryableError } from "./retry";

describe("Retry Utility", () => {
  describe("withRetry", () => {
    it("succeeds on first attempt", async () => {
      const fn = vi.fn().mockResolvedValue("success");

      const result = await withRetry(fn);

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries on retryable errors", async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValue("success");

      const result = await withRetry(fn, { maxAttempts: 3 });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("throws after max attempts", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("timeout"));

      await expect(withRetry(fn, { maxAttempts: 2 })).rejects.toThrow("timeout");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("respects retryableErrors filter", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("validation error"));

      await expect(
        withRetry(fn, {
          maxAttempts: 3,
          retryableErrors: isRetryableError,
        }),
      ).rejects.toThrow("validation error");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("calls onRetry callback", async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValue("success");
      const onRetry = vi.fn();

      await withRetry(fn, { maxAttempts: 3, onRetry });

      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("isRetryableError", () => {
    it("identifies retryable errors", () => {
      expect(isRetryableError(new Error("timeout"))).toBe(true);
      expect(isRetryableError(new Error("ETIMEDOUT"))).toBe(true);
      expect(isRetryableError(new Error("rate limit exceeded"))).toBe(true);
      expect(isRetryableError(new Error("503 Service Unavailable"))).toBe(true);
    });

    it("identifies non-retryable errors", () => {
      expect(isRetryableError(new Error("validation failed"))).toBe(false);
      expect(isRetryableError(new Error("404 Not Found"))).toBe(false);
      expect(isRetryableError(new Error("401 Unauthorized"))).toBe(false);
    });
  });

  describe("isNonRetryableError", () => {
    it("identifies non-retryable errors", () => {
      expect(isNonRetryableError(new Error("validation failed"))).toBe(true);
      expect(isNonRetryableError(new Error("404 Not Found"))).toBe(true);
      expect(isNonRetryableError(new Error("401 Unauthorized"))).toBe(true);
    });

    it("identifies retryable errors as not non-retryable", () => {
      expect(isNonRetryableError(new Error("timeout"))).toBe(false);
      expect(isNonRetryableError(new Error("503 Service Unavailable"))).toBe(false);
    });
  });
});
