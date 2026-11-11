import { describe, expect, it } from "vitest";
import { chunkItems, chunkItemsBySize } from "../src/pipeline/batcher";

describe("chunkItems", () => {
  it("splits items into bounded batches", () => {
    expect(chunkItems([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns no batches for an empty input", () => {
    expect(chunkItems([], 10)).toEqual([]);
  });

  it("never returns a zero-size batch", () => {
    expect(chunkItems([1, 2], 0)).toEqual([[1], [2]]);
  });
});

describe("chunkItemsBySize", () => {
  it("splits on the byte budget", () => {
    const encode = (value: string) => new TextEncoder().encode(value);
    expect(
      chunkItemsBySize(["aaa", "bbb", "ccc"], 10, 7, encode),
    ).toEqual([["aaa"], ["bbb"], ["ccc"]]);
  });

  it("keeps an oversized item in its own batch", () => {
    const encode = (value: string) => new TextEncoder().encode(value);
    expect(
      chunkItemsBySize(["a", "0123456789", "b"], 10, 5, encode),
    ).toEqual([["a"], ["0123456789"], ["b"]]);
  });
});
