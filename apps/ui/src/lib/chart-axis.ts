const TICK_COUNT = 5;
const TWO_DAYS = 48 * 60 * 60 * 1000;

export function axisLabels(timestamps: number[]): string[] {
  const first = timestamps[0];
  const last = timestamps[timestamps.length - 1];
  if (first == null || last == null) return [];
  const showDate = last - first > TWO_DAYS;
  return Array.from({ length: TICK_COUNT }, (_, index) => {
    const at = new Date(first + ((last - first) * index) / (TICK_COUNT - 1));
    return showDate
      ? at.toLocaleDateString([], { month: 'short', day: 'numeric' })
      : at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
}
