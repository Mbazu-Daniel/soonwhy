import { describe, expect, it, beforeEach } from "vitest";
import { PIIMaskingService } from "./pii-masking";

describe("PIIMaskingService", () => {
  let service: PIIMaskingService;

  beforeEach(() => {
    service = new PIIMaskingService();
  });

  describe("maskText", () => {
    it("masks email addresses", () => {
      const text = "Contact user@example.com for support";
      const masked = service.maskText(text);

      expect(masked).toBe("Contact [EMAIL] for support");
    });

    it("masks phone numbers", () => {
      const text = "Call 555-123-4567 for help";
      const masked = service.maskText(text);

      expect(masked).toBe("Call [PHONE] for help");
    });

    it("masks IP addresses", () => {
      const text = "Request from 192.168.1.1";
      const masked = service.maskText(text);

      expect(masked).toBe("Request from [IP]");
    });

    it("masks tokens", () => {
      const text = "API key: abcdefghijklmnopqrstuvwxyz123456";
      const masked = service.maskText(text);

      expect(masked).toBe("API key: [TOKEN]");
    });

    it("leaves clean text unchanged", () => {
      const text = "User request failed with timeout";
      const masked = service.maskText(text);

      expect(masked).toBe(text);
    });
  });

  describe("maskObject", () => {
    it("masks string properties", () => {
      const obj = {
        email: "user@example.com",
        name: "John Doe",
      };
      const masked = service.maskObject(obj);

      expect(masked.email).toBe("[EMAIL]");
      expect(masked.name).toBe("John Doe");
    });

    it("masks nested objects", () => {
      const obj = {
        user: {
          email: "user@example.com",
          phone: "555-123-4567",
        },
      };
      const masked = service.maskObject(obj);

      expect(masked.user.email).toBe("[EMAIL]");
      expect(masked.user.phone).toBe("[PHONE]");
    });

    it("masks arrays", () => {
      const obj = {
        emails: ["user1@example.com", "user2@example.com"],
      };
      const masked = service.maskObject(obj);

      expect(masked.emails[0]).toBe("[EMAIL]");
      expect(masked.emails[1]).toBe("[EMAIL]");
    });

    it("preserves non-string values", () => {
      const obj = {
        count: 42,
        active: true,
        score: 0.95,
      };
      const masked = service.maskObject(obj);

      expect(masked.count).toBe(42);
      expect(masked.active).toBe(true);
      expect(masked.score).toBe(0.95);
    });
  });

  describe("maskError", () => {
    it("masks error message", () => {
      const error = new Error("Failed to send email to user@example.com");
      const masked = service.maskError(error);

      expect(masked.message).toBe("Failed to send email to [EMAIL]");
    });

    it("masks error stack", () => {
      const error = new Error("Test");
      error.stack = "at process (user@example.com)";
      const masked = service.maskError(error);

      expect(masked.stack).toContain("[EMAIL]");
    });
  });
});
