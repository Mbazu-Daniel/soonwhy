import { FINGERPRINT_FRAME_COUNT, FRAME_PATTERN, FRAME_POSITION_PATTERN } from "./error.constants";
import { summarizeStack } from "./stack-summary";

function frameKey(frame: string): string {
  const match = FRAME_PATTERN.exec(frame);
  if (!match) return frame;
  const [, name = "", location = ""] = match;
  const file = location.replace(FRAME_POSITION_PATTERN, "").split(/[\\/]/).pop() ?? "";
  return `${name}@${file}`;
}

export function stackFingerprintBasis(stack: string | undefined): string | null {
  const frames = summarizeStack(stack)?.applicationFrames ?? [];
  if (frames.length === 0) return null;
  return frames.slice(0, FINGERPRINT_FRAME_COUNT).map(frameKey).join(">");
}
