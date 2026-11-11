import { describe, expect, it } from "vitest";
import { createTelemetryIdentity } from "./telemetry-identity";
import { generateEventId } from "./event-id";
import {
  fingerprintService,
  fingerprintRoute,
  fingerprintTrace,
  fingerprintSpan,
  fingerprintError,
  fingerprintQuery,
  fingerprintDependency,
  fingerprintHost,
  fingerprintAIOperation,
} from "./fingerprints";

describe("telemetry identity - shared package", () => {
  describe("createTelemetryIdentity", () => {
    it("creates identity with SHA-256 fingerprint", () => {
      const identity = createTelemetryIdentity({
        domain: "performance",
        serviceName: "checkout",
        operationName: "POST /checkout",
      });

      expect(identity.fingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(identity.fingerprintVersion).toBe(1);
      expect(identity.domain).toBe("performance");
      expect(identity.serviceName).toBe("checkout");
      expect(identity.operationName).toBe("POST /checkout");
    });

    it("produces stable fingerprints for identical inputs", () => {
      const first = createTelemetryIdentity({
        domain: "performance",
        serviceName: "checkout",
        operationName: "POST /checkout",
      });
      const second = createTelemetryIdentity({
        domain: "performance",
        serviceName: "checkout",
        operationName: "POST /checkout",
      });

      expect(first.fingerprint).toBe(second.fingerprint);
    });

    it("produces different fingerprints for different inputs", () => {
      const first = createTelemetryIdentity({
        domain: "performance",
        serviceName: "checkout",
        operationName: "POST /checkout",
      });
      const second = createTelemetryIdentity({
        domain: "performance",
        serviceName: "checkout",
        operationName: "GET /users",
      });

      expect(first.fingerprint).not.toBe(second.fingerprint);
    });

    it("includes identity attributes in fingerprint", () => {
      const first = createTelemetryIdentity({
        domain: "dependency",
        serviceName: "checkout",
        operationName: "http",
        identityAttributes: { target: "payment-api" },
      });
      const second = createTelemetryIdentity({
        domain: "dependency",
        serviceName: "checkout",
        operationName: "http",
        identityAttributes: { target: "user-api" },
      });

      expect(first.fingerprint).not.toBe(second.fingerprint);
    });
  });

  describe("fingerprintService", () => {
    it("creates stable service fingerprints", () => {
      const first = fingerprintService("checkout", {
        environment: "production",
      });
      const second = fingerprintService("checkout", {
        environment: "production",
      });

      expect(first).toBe(second);
    });

    it("differentiates by environment", () => {
      const prod = fingerprintService("checkout", { environment: "production" });
      const staging = fingerprintService("checkout", { environment: "staging" });

      expect(prod).not.toBe(staging);
    });
  });

  describe("fingerprintRoute", () => {
    it("creates stable route fingerprints", () => {
      const first = fingerprintRoute("POST", "/checkout", "checkout");
      const second = fingerprintRoute("POST", "/checkout", "checkout");

      expect(first).toBe(second);
    });

    it("differentiates by HTTP method", () => {
      const post = fingerprintRoute("POST", "/checkout", "checkout");
      const get = fingerprintRoute("GET", "/checkout", "checkout");

      expect(post).not.toBe(get);
    });
  });

  describe("fingerprintTrace", () => {
    it("creates stable trace fingerprints", () => {
      const first = fingerprintTrace("trace-123");
      const second = fingerprintTrace("trace-123");

      expect(first).toBe(second);
    });
  });

  describe("fingerprintSpan", () => {
    it("creates stable span fingerprints with parent context", () => {
      const first = fingerprintSpan(
        "db-query",
        { spanId: "span-123" },
        "parent-456",
      );
      const second = fingerprintSpan(
        "db-query",
        { spanId: "span-123" },
        "parent-456",
      );

      expect(first).toBe(second);
    });

    it("differentiates by parent span", () => {
      const first = fingerprintSpan(
        "db-query",
        { spanId: "span-123" },
        "parent-456",
      );
      const second = fingerprintSpan(
        "db-query",
        { spanId: "span-123" },
        "parent-789",
      );

      expect(first).not.toBe(second);
    });
  });

  describe("fingerprintError", () => {
    it("creates stable error fingerprints with normalized stack traces", () => {
      const first = fingerprintError(
        "TypeError",
        "Cannot read properties of undefined",
        "at foo (file.js:10:5)",
      );
      const second = fingerprintError(
        "TypeError",
        "Cannot read properties of undefined",
        "at foo (file.js:10:5)",
      );

      expect(first).toBe(second);
    });

    it("differentiates by error type", () => {
      const typeError = fingerprintError(
        "TypeError",
        "Cannot read properties of undefined",
        "at foo (file.js:10:5)",
      );
      const referenceError = fingerprintError(
        "ReferenceError",
        "foo is not defined",
        "at bar (file.js:15:5)",
      );

      expect(typeError).not.toBe(referenceError);
    });
  });

  describe("fingerprintQuery", () => {
    it("creates stable query fingerprints with SQL normalization", () => {
      const first = fingerprintQuery("SELECT * FROM users WHERE id = 1");
      const second = fingerprintQuery("SELECT * FROM users WHERE id = 2");

      expect(first).toBe(second);
    });

    it("handles IN clause cardinality", () => {
      const first = fingerprintQuery("SELECT * FROM users WHERE id IN (1, 2, 3)");
      const second = fingerprintQuery("SELECT * FROM users WHERE id IN (4, 5, 6)");

      expect(first).toBe(second);
    });
  });

  describe("fingerprintDependency", () => {
    it("creates stable dependency fingerprints", () => {
      const first = fingerprintDependency("http", "payment-api", "checkout");
      const second = fingerprintDependency("http", "payment-api", "checkout");

      expect(first).toBe(second);
    });

    it("differentiates by dependency type", () => {
      const http = fingerprintDependency("http", "payment-api", "checkout");
      const grpc = fingerprintDependency("grpc", "payment-api", "checkout");

      expect(http).not.toBe(grpc);
    });
  });

  describe("fingerprintHost", () => {
    it("creates stable host fingerprints", () => {
      const first = fingerprintHost("host-123", "container-456");
      const second = fingerprintHost("host-123", "container-456");

      expect(first).toBe(second);
    });
  });

  describe("fingerprintAIOperation", () => {
    it("creates stable AI operation fingerprints", () => {
      const first = fingerprintAIOperation("openai", "gpt-4", "chat");
      const second = fingerprintAIOperation("openai", "gpt-4", "chat");

      expect(first).toBe(second);
    });

    it("differentiates by model", () => {
      const gpt4 = fingerprintAIOperation("openai", "gpt-4", "chat");
      const gpt35 = fingerprintAIOperation("openai", "gpt-3.5-turbo", "chat");

      expect(gpt4).not.toBe(gpt35);
    });
  });

  describe("generateEventId", () => {
    it("generates versioned SHA-256 event IDs", () => {
      const id = generateEventId({ name: "test-event" });

      expect(id).toMatch(/^1:[a-f0-9]{64}$/);
    });

    it("produces stable IDs for same input", () => {
      const first = generateEventId({ name: "test-event" });
      const second = generateEventId({ name: "test-event" });

      expect(first).toBe(second);
    });

    it("produces different IDs for different inputs", () => {
      const first = generateEventId({ name: "event-1" });
      const second = generateEventId({ name: "event-2" });

      expect(first).not.toBe(second);
    });
  });
});
