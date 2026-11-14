export interface StackCause {
  header: string;
  topFrame: string | null;
}

export interface StackSummary {
  header: string;
  applicationFrames: string[];
  causes: StackCause[];
}
