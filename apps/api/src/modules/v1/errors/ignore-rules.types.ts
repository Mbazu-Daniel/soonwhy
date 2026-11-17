export interface ErrorIgnoreRule {
  id: string;
  pathPattern: string;
  status: string | null;
  createdAt: Date;
}

export interface IgnoreRuleMatcher {
  pathPattern: string;
  status: string | null;
}
