import { describe, expect, it } from "vitest";
import { DEFAULT_CAPTURE_SETTINGS } from "@soonwhy/shared";
import { batchEventId } from "../src/pipeline/batch-id";

const identity = {
  signal: "log",
  organizationId: "org",
  projectId: "project",
  captureSettings: DEFAULT_CAPTURE_SETTINGS,
};

describe("batchEventId", () => {
  it("differs for batches with the same size and different content", () => {
    const first = batchEventId(identity, [{ message: "a" }, { message: "b" }]);
    const second = batchEventId(identity, [{ message: "c" }, { message: "d" }]);
    expect(first).not.toBe(second);
  });

  it("is the same when the same batch is sent again", () => {
    const items = [{ message: "a" }, { message: "b" }];
    expect(batchEventId(identity, items)).toBe(batchEventId(identity, [...items]));
  });

  it("differs between projects for the same content", () => {
    const items = [{ message: "a" }];
    expect(batchEventId(identity, items)).not.toBe(batchEventId({ ...identity, projectId: "other" }, items));
  });
});
