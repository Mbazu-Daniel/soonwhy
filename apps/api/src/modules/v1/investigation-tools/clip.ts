import { TOOL_MAX_TEXT } from "./investigation-tools.constants";

export function clip(value: string | undefined, max = TOOL_MAX_TEXT): string {
  if (!value) return "";
  return value.length > max ? `${value.slice(0, max)}…` : value;
}
