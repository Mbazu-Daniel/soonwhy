import { describe, expect, it } from "vitest";
import { mergeFieldMappings } from "./service";

const message = { name: "message", type: "text", tokenizer: "default", record: "position", stored: true };

describe("mergeFieldMappings", () => {
  it("adds a field the index does not have", () => {
    const result = mergeFieldMappings([{ name: "service", type: "text" }], [message]);
    expect(result.changed).toBe(true);
    expect(result.fieldMappings.map((field) => field.name)).toEqual(["service", "message"]);
  });

  it("replaces a field whose tokenizer differs", () => {
    const result = mergeFieldMappings([{ name: "message", type: "text", tokenizer: "raw" }], [message]);
    expect(result.changed).toBe(true);
    expect(result.fieldMappings).toEqual([message]);
  });

  it("changes nothing when behaviour matches, even if Quickwit added defaults", () => {
    const stored = { ...message, fast: false, fieldnorms: false, indexed: true };
    const result = mergeFieldMappings([stored], [message]);
    expect(result.changed).toBe(false);
    expect(result.fieldMappings).toEqual([stored]);
  });

  it("ignores fast and normalizer differences", () => {
    const result = mergeFieldMappings(
      [{ name: "service", type: "text", tokenizer: "raw", fast: { normalizer: "raw" } }],
      [{ name: "service", type: "text", tokenizer: "raw", fast: true }],
    );
    expect(result.changed).toBe(false);
  });
});
