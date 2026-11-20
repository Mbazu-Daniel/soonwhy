export function pathOf(message: string): string {
  const match = message.match(/^\S+\s+(\S+)/);
  const target = match?.[1] ?? "";
  return target.split("?")[0] ?? "";
}
