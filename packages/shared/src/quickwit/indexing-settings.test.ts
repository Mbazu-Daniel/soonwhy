import { describe, expect, it } from "vitest";
import { QUICKWIT_INDEX_CONFIG } from "./config";
import { desiredCommitTimeout, withCommitTimeout } from "./indexing-settings";

describe("desiredCommitTimeout", () => {
  it("reads the commit timeout from the shared index config", () => {
    expect(desiredCommitTimeout(QUICKWIT_INDEX_CONFIG as never)).toBe(60);
  });

  it("ignores missing or invalid values", () => {
    expect(desiredCommitTimeout({})).toBeUndefined();
    expect(desiredCommitTimeout({ indexing_settings: { commit_timeout_secs: 0 } })).toBeUndefined();
    expect(desiredCommitTimeout({ indexing_settings: { commit_timeout_secs: "60" } })).toBeUndefined();
    expect(desiredCommitTimeout({ indexing_settings: { commit_timeout_secs: 1.5 } })).toBeUndefined();
  });
});

describe("withCommitTimeout", () => {
  it("changes only the commit timeout and keeps the rest of the index config", () => {
    const current = {
      index_id: "telemetry-metrics",
      indexing_settings: { commit_timeout_secs: 10, merge_policy: { type: "stable_log" } },
      retention: { period: "30 days" },
    };
    expect(withCommitTimeout(current, 60)).toEqual({
      index_id: "telemetry-metrics",
      indexing_settings: { commit_timeout_secs: 60, merge_policy: { type: "stable_log" } },
      retention: { period: "30 days" },
    });
  });

  it("drops the doc mapping uid like the field mapping update does", () => {
    const updated = withCommitTimeout({ doc_mapping: { doc_mapping_uid: "abc", mode: "dynamic" } }, 60) as any;
    expect(updated.doc_mapping).toEqual({ mode: "dynamic" });
  });

  it("does nothing when the index already has the value", () => {
    expect(withCommitTimeout({ indexing_settings: { commit_timeout_secs: 60 } }, 60)).toBeUndefined();
  });

  it("sets it when the index has no indexing settings yet", () => {
    expect(withCommitTimeout({ index_id: "x" }, 60)).toEqual({
      index_id: "x",
      indexing_settings: { commit_timeout_secs: 60 },
    });
  });
});
