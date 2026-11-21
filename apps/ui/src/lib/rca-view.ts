export const NOT_ESTABLISHED = /^\s*not established/i;

export function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : text).trim();
}

function stripCandidate(step: string): string {
  return step.replace(/^candidate:\s*/i, '');
}

export function splitVerify(step: string): { action: string; verify: string } {
  const text = stripCandidate(step);
  const match = text.match(/^(.*?)[\s—–-]+verify first[:\s]*(.*)$/i);
  return match ? { action: match[1].trim(), verify: match[2].trim() } : { action: text, verify: '' };
}
