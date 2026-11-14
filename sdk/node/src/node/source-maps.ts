export function enableSourceMaps(): boolean {
  if (typeof process.setSourceMapsEnabled !== "function") return false;
  process.setSourceMapsEnabled(true);
  return true;
}
