import type { RcaConfidence } from '~/lib/rca.types';

export const NOT_ESTABLISHED = /^\s*not established/i;

export const CONFIDENCE_STYLES: Record<RcaConfidence, string> = {
  low: 'bg-[#FEF3C7] text-[#713F12]',
  medium: 'bg-[#DBEAFE] text-[#1E3A8A]',
  high: 'bg-[#DCFCE7] text-[#14532D]',
};

export function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : text).trim();
}

export function stripCandidate(step: string): string {
  return step.replace(/^candidate:\s*/i, '');
}

export function splitVerify(step: string): { action: string; verify: string } {
  const text = stripCandidate(step);
  const match = text.match(/^(.*?)[\s—–-]+verify first[:\s]*(.*)$/i);
  return match ? { action: match[1].trim(), verify: match[2].trim() } : { action: text, verify: '' };
}
