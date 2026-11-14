export type FrameOrigin = 'app' | 'library' | 'internal';

export interface StackFrame {
  raw: string;
  fn: string;
  file: string;
  line: number | null;
  column: number | null;
  origin: FrameOrigin;
}

export interface StackSection {
  header: string;
  frames: StackFrame[];
  isCause: boolean;
}
