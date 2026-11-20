export interface RcaOrigin {
  trigger: "manual" | "auto";
  evidenceHash: string | null;
}

export const MANUAL_ORIGIN: RcaOrigin = { trigger: "manual", evidenceHash: null };
