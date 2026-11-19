import {
  CAUSE_MARKER,
  LIBRARY_FRAME,
  MAX_APPLICATION_FRAMES,
  MAX_CAUSES,
  MAX_FRAME_LENGTH,
} from "./error.constants";
import type { StackCause, StackSummary } from "./stack-summary.types";

interface Block {
  header: string;
  frames: string[];
}

function toBlocks(stack: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of stack.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("at ")) {
      const current = blocks[blocks.length - 1] ?? { header: "", frames: [] };
      if (blocks.length === 0) blocks.push(current);
      current.frames.push(line.slice(0, MAX_FRAME_LENGTH));
      continue;
    }
    const current = blocks[blocks.length - 1];
    if (CAUSE_MARKER.test(line) || !current || current.frames.length > 0) {
      blocks.push({ header: line.replace(CAUSE_MARKER, ""), frames: [] });
    } else {
      current.header = current.header ? `${current.header}\n${line}` : line;
    }
  }
  return blocks;
}

function applicationFramesOf(block: Block): string[] {
  return block.frames.filter((frame) => !LIBRARY_FRAME.test(frame));
}

export function summarizeStack(stack: string | undefined): StackSummary | null {
  if (!stack?.trim()) return null;
  const [first, ...rest] = toBlocks(stack);
  if (!first) return null;
  const causes: StackCause[] = rest.slice(0, MAX_CAUSES).map((block) => ({
    header: block.header.slice(0, MAX_FRAME_LENGTH),
    topFrame: applicationFramesOf(block)[0] ?? block.frames[0] ?? null,
  }));
  return {
    header: first.header.slice(0, MAX_FRAME_LENGTH),
    applicationFrames: applicationFramesOf(first).slice(0, MAX_APPLICATION_FRAMES),
    causes,
  };
}
