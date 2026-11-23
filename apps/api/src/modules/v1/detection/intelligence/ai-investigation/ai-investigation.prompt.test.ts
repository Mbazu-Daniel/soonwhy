import { describe, expect, it } from "vitest";
import { INVESTIGATION_AGENT_INSTRUCTIONS, buildInvestigationPrompt, shortenInvestigationText, limitList } from "./ai-investigation.prompt";

describe("investigation prompt", () => {
  it("asks for a short, prioritised answer with specific actions", () => {
    expect(INVESTIGATION_AGENT_INSTRUCTIONS).toMatch(/at most two sentences/i);
    expect(INVESTIGATION_AGENT_INSTRUCTIONS).toMatch(/at most 3/i);
    expect(INVESTIGATION_AGENT_INSTRUCTIONS).toMatch(/most important first/i);
    expect(INVESTIGATION_AGENT_INSTRUCTIONS).toMatch(/generic advice/i);
  });

  it("includes the evidence and the question when one is asked", () => {
    const prompt = buildInvestigationPrompt("EVIDENCE-BLOCK", "Why is checkout slow?");
    expect(prompt).toContain("EVIDENCE-BLOCK");
    expect(prompt).toContain("Why is checkout slow?");
    expect(buildInvestigationPrompt("EVIDENCE-BLOCK")).not.toContain("SPECIFIC QUESTION");
  });

  it("no longer asks for an exhaustive seven-part report", () => {
    expect(buildInvestigationPrompt("e")).not.toMatch(/7\. Cite specific evidence/);
  });
});

describe("investigation length limits", () => {
  it("keeps the first three list items", () => {
    expect(limitList(["a", "b", "c", "d"])).toEqual(["a", "b", "c"]);
  });

  it("cuts long text at a sentence end", () => {
    const long = "The database pool is exhausted under load. ".repeat(30);
    const cut = shortenInvestigationText(long, 300);
    expect(cut.length).toBeLessThanOrEqual(300);
    expect(cut.endsWith(".")).toBe(true);
  });

  it("leaves short text alone", () => {
    expect(shortenInvestigationText("Short.", 300)).toBe("Short.");
  });
});
