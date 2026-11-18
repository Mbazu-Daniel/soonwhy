export type FakeDbOperation = "select" | "insert" | "update" | "delete";

export type FakeDbResults = Partial<Record<FakeDbOperation, unknown[]>>;

export type FakeDbCall = {
  operation: FakeDbOperation;
  steps: { method: string; args: unknown[] }[];
};
