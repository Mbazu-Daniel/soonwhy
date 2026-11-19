import { describe, expect, it } from "vitest";
import { sanitizeSpan } from "./span-sanitizer";

const OPTIONS = { redactSensitiveData: true, maxAttributeCount: 100, maxAttributeValueLength: 4096 };

describe("sanitizeSpan", () => {
  it("redacts sensitive attribute keys and query secrets in urls", () => {
    const span = {
      attributes: {
        "http.request.header.authorization": "Bearer abc",
        "url.full": "https://api.example.com/x?token=abc&page=2",
        "url.query": "api_key=zzz&q=1",
        "db.system": "postgresql",
      },
    };
    sanitizeSpan(span, OPTIONS);
    expect(span.attributes["http.request.header.authorization"]).toBe("[REDACTED]");
    expect(span.attributes["url.full"]).toBe("https://api.example.com/x?token=[REDACTED]&page=2");
    expect(span.attributes["url.query"]).toBe("api_key=[REDACTED]&q=1");
    expect(span.attributes["db.system"]).toBe("postgresql");
  });

  it("leaves urls untouched when redaction is off", () => {
    const span = { attributes: { "url.full": "https://a.b/x?token=abc" } };
    sanitizeSpan(span, { ...OPTIONS, redactSensitiveData: false });
    expect(span.attributes["url.full"]).toBe("https://a.b/x?token=abc");
  });
});
