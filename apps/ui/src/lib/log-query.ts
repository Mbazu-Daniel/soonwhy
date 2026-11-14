import type { LogFilterChip } from '~/lib/log-types';

export function quoteValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function chipToken(chip: LogFilterChip): string {
  const token = `${chip.field}:${quoteValue(chip.value)}`;
  return chip.negate ? `NOT ${token}` : token;
}

export function buildQuery(text: string, chips: LogFilterChip[]): string {
  const parts = [text.trim() ? `(${text.trim()})` : '', ...chips.map(chipToken)].filter(Boolean);
  return parts.join(' AND ');
}

export function sameChip(a: LogFilterChip, b: LogFilterChip): boolean {
  return a.field === b.field && a.value === b.value && a.negate === b.negate;
}
