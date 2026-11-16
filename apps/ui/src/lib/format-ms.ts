export function formatMsValue(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toPrecision(2))) : '0';
}

export function formatMs(value: number): string {
  return `${formatMsValue(value)}ms`;
}
