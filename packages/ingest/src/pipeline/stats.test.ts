import { describe, expect, it, vi } from "vitest";
import type { AlertNotifier } from "./alert-notifier";
import { REJECTED_DOCS_ALERT_THRESHOLD_DEFAULT } from "./constants";
import { IngestStats, rejectedDocsAlertThreshold } from "./stats";

describe("IngestStats", () => {
  it("tracks in-flight and peak request capacity", () => {
    const stats = new IngestStats();
    stats.beginRequest();
    stats.beginRequest();
    stats.endRequest();
    expect(stats.snapshot()).toMatchObject({ inFlight: 1, peakInFlight: 2 });
    stats.endRequest();
    stats.endRequest();
    expect(stats.snapshot()).toMatchObject({ inFlight: 0, peakInFlight: 2 });
  });

  it("counts documents rejected by the store", () => {
    const stats = new IngestStats();
    stats.recordRejectedDocs(2);
    stats.recordRejectedDocs(3);
    expect(stats.snapshot().rejectedDocs).toBe(5);
  });

  describe("rejected documents alert", () => {
    it("stays quiet below the threshold", () => {
      const stats = new IngestStats();
      stats.recordRejectedDocs(4);
      expect(stats.checkRejectedDocsAlert(5)).toBe(false);
    });

    it("fires at the threshold and measures each interval from the previous check", () => {
      const stats = new IngestStats();
      stats.recordRejectedDocs(5);
      expect(stats.checkRejectedDocsAlert(5)).toBe(true);
      expect(stats.checkRejectedDocsAlert(5)).toBe(false);
      stats.recordRejectedDocs(7);
      expect(stats.checkRejectedDocsAlert(5)).toBe(true);
    });
  });

  describe("rejectedDocsAlertThreshold", () => {
    it("uses a valid configured value", () => {
      expect(rejectedDocsAlertThreshold("25")).toBe(25);
    });

    it.each([undefined, "", "0", "-3", "1.5", "abc"])("falls back to the default for %j", (value) => {
      expect(rejectedDocsAlertThreshold(value)).toBe(REJECTED_DOCS_ALERT_THRESHOLD_DEFAULT);
    });
  });

  it("sends the rejected documents alert to the notifier, and stays quiet below the threshold", () => {
    const notifier = { notify: vi.fn().mockResolvedValue(true) };
    const stats = new IngestStats(notifier as unknown as AlertNotifier);

    stats.recordRejectedDocs(3);
    expect(stats.checkRejectedDocsAlert(10)).toBe(false);
    expect(notifier.notify).not.toHaveBeenCalled();

    stats.recordRejectedDocs(12);
    expect(stats.checkRejectedDocsAlert(10)).toBe(true);
    expect(notifier.notify).toHaveBeenCalledWith("rejected_docs", expect.stringContaining("rejected 12 documents"));
  });
});
