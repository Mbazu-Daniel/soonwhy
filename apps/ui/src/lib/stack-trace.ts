import { CAUSE_MARKER, FIREFOX_FRAME, INTERNAL_PATH, LIBRARY_PATH, NODE_FRAME, NODE_FRAME_NO_POSITION } from './stack-trace.constants';
import type { FrameOrigin, StackFrame, StackSection } from './stack-trace.types';

function originOf(file: string): FrameOrigin {
  if (INTERNAL_PATH.test(file)) return 'internal';
  if (LIBRARY_PATH.test(file)) return 'library';
  return 'app';
}

function toFrame(raw: string, fn: string | undefined, file: string, line: string | undefined, column: string | undefined): StackFrame {
  return {
    raw,
    fn: fn?.trim() || '<anonymous>',
    file,
    line: line ? Number(line) : null,
    column: column ? Number(column) : null,
    origin: originOf(file),
  };
}

export function parseFrame(line: string): StackFrame | null {
  const text = line.trim();
  const node = NODE_FRAME.exec(text);
  if (node) return toFrame(text, node[1], node[2] ?? '', node[3], node[4]);
  const firefox = FIREFOX_FRAME.exec(text);
  if (firefox) return toFrame(text, firefox[1], firefox[2] ?? '', firefox[3], firefox[4]);
  if (text.startsWith('at ')) {
    const bare = NODE_FRAME_NO_POSITION.exec(text);
    if (bare) return toFrame(text, bare[1], bare[2] ?? '', undefined, undefined);
  }
  return null;
}

export function parseStackTrace(stack: string): StackSection[] {
  const sections: StackSection[] = [];
  for (const line of stack.split('\n')) {
    const text = line.trim();
    if (!text) continue;
    const frame = parseFrame(text);
    const current = sections[sections.length - 1];
    if (frame && current) {
      current.frames.push(frame);
      continue;
    }
    if (frame) {
      sections.push({ header: '', frames: [frame], isCause: false });
      continue;
    }
    if (CAUSE_MARKER.test(text)) {
      sections.push({ header: text.replace(CAUSE_MARKER, ''), frames: [], isCause: true });
      continue;
    }
    if (current && current.frames.length === 0 && !current.header) {
      current.header = text;
      continue;
    }
    if (current && current.frames.length === 0) {
      current.header = `${current.header}\n${text}`;
      continue;
    }
    sections.push({ header: text, frames: [], isCause: false });
  }
  return sections;
}
