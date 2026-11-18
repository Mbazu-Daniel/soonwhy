export interface ErrorIgnoreRule {
  id: string;
  pathPattern: string;
  status: string | null;
  createdAt: string;
}

export interface IgnoreRuleDraft {
  pathPattern: string;
  status: string;
}
