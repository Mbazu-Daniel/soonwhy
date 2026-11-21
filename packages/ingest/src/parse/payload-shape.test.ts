import { describe, expect, it } from "vitest";
import { describePayload, shapePayloadAttributes } from "./payload-shape";

const ON = { captureRequestBody: true, captureResponseBody: true };

describe("describePayload", () => {
  it("keeps field names and types but never values", () => {
    const stored = describePayload(JSON.stringify({ email: "jane@example.com", age: 41, card: { number: "4111111111111111" }, tags: ["a", "b"] }));
    expect(stored.format).toBe("json");
    expect(stored.shape).toEqual({
      type: "object",
      fields: {
        email: { type: "string" },
        age: { type: "number" },
        card: { type: "object", fields: { number: { type: "string" } } },
        tags: { type: "array", length: 2, items: { type: "string" } },
      },
    });
    expect(JSON.stringify(stored)).not.toMatch(/jane|4111/);
  });

  it("records only the size of a body that is not JSON", () => {
    expect(describePayload("plain secret text")).toEqual({ bytes: 17, format: "text" });
  });

  it("stops descending past the depth limit", () => {
    let nested: unknown = "x";
    for (let i = 0; i < 12; i += 1) nested = { a: nested };
    expect(JSON.stringify(describePayload(JSON.stringify(nested)))).toContain('"deep"');
  });
});

describe("shapePayloadAttributes", () => {
  const attrs = { "http.request.body": '{"password":"hunter2"}', "http.response.body": '{"ok":true}', other: "kept" };

  it("replaces bodies with their shape", () => {
    const out = shapePayloadAttributes(attrs, ON);
    expect(out["http.request.body"]).not.toContain("hunter2");
    expect(JSON.parse(out["http.request.body"] as string).shape.fields.password).toEqual({ type: "string" });
    expect(out.other).toBe("kept");
  });

  it("keeps a shape the SDK already computed instead of shaping it again", () => {
    const sent = JSON.stringify({ bytes: 30, format: "json", shape: { type: "object", fields: { id: { type: "number" } } } });
    expect(shapePayloadAttributes({ "http.response.body": sent }, ON)["http.response.body"]).toBe(sent);
  });

  it("drops a body whose capture is switched off", () => {
    const out = shapePayloadAttributes(attrs, { captureRequestBody: false, captureResponseBody: true });
    expect(out).not.toHaveProperty("http.request.body");
    expect(out).toHaveProperty("http.response.body");
  });
});
