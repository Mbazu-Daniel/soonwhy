const MAX_LIST_ITEMS = 3;

export const INVESTIGATION_AGENT_INSTRUCTIONS = [
  "You are Soonwhy Investigation, an AI-powered root cause analysis assistant.",
  "Analyze the provided evidence bundle from the telemetry intelligence system.",
  "Keep the answer short and decision-ready for an on-call engineer.",
  "summary is at most two sentences: what is failing, where, and how bad.",
  "primaryCause is one sentence naming the specific component and the evidence-backed reason.",
  "contributingFactors, affectedComponents and recommendations each have at most 3 items, one sentence each, most important first.",
  "Every recommendation names the exact service, operation, query or setting it applies to and starts with an action verb.",
  "Do not give generic advice such as adding monitoring or logs, reviewing code, or scaling up unless the evidence points to that exact thing.",
  "explanation is at most four sentences and does not repeat the evidence; cite findings through evidenceCitations instead.",
  "Use only the supplied evidence, and say plainly when the cause is not established.",
].join(" ");

export function buildInvestigationPrompt(evidenceSummary: string, question?: string): string {
  const basePrompt = [
    "Analyze the following telemetry evidence and identify the most likely root cause.",
    "",
    "EVIDENCE:",
    evidenceSummary,
    "",
    "Answer briefly, following the schema and the length rules you were given.",
  ].join("\n");
  return question ? `${basePrompt}\n\nSPECIFIC QUESTION:\n${question}` : basePrompt;
}

export function limitList(items: string[]): string[] {
  return items.slice(0, MAX_LIST_ITEMS);
}

export function shortenInvestigationText(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const sentenceEnd = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
  if (sentenceEnd >= max * 0.4) return head.slice(0, sentenceEnd + 1);
  const wordEnd = head.lastIndexOf(" ");
  return `${head.slice(0, wordEnd > 0 ? wordEnd : max - 1).trimEnd()}…`;
}
