import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { QUICKWIT_INDEX_CONFIG, QUICKWIT_INDEXES } from "../src/quickwit/config";

describe("index mapping", () => {
  const fields = QUICKWIT_INDEX_CONFIG.doc_mapping.field_mappings as Array<{ name: string; type: string; tokenizer?: string; fast?: boolean }>;

  it("is one shared mapping applied to every index", () => {
    expect(Object.values(QUICKWIT_INDEXES)).toHaveLength(5);
  });

  it("stores the event id as a raw, fast text field, which the lookup and duplicate checks rely on", () => {
    const field = fields.find((candidate) => candidate.name === "eventId");

    expect(field).toMatchObject({ type: "text", tokenizer: "raw", fast: true });
  });
});

describe("quickwit node config", () => {
  it("runs the ingest API without replication", () => {
    const config = readFileSync(resolve(__dirname, "../../../infra/quickwit/quickwit.yaml"), "utf8");

    expect(config).toMatch(/ingest_api:\s*\n\s+replication_factor:\s*1\b/);
  });
});
