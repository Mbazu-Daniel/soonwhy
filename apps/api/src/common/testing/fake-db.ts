import type { FakeDbCall, FakeDbOperation, FakeDbResults } from "./fake-db.types";

const OPERATIONS: FakeDbOperation[] = ["select", "insert", "update", "delete"];

let queues: Record<FakeDbOperation, unknown[]> = emptyQueues();
let calls: FakeDbCall[] = [];

function emptyQueues(): Record<FakeDbOperation, unknown[]> {
  return { select: [], insert: [], update: [], delete: [] };
}

function chainFor(operation: FakeDbOperation, initialArgs: unknown[] = []): unknown {
  const call: FakeDbCall = { operation, steps: [{ method: operation, args: initialArgs }] };
  calls.push(call);
  const result = queues[operation].length > 0 ? queues[operation].shift() : [];
  const chain: unknown = new Proxy(function chainTarget() {}, {
    get: (_target, property) => {
      if (property === "then") {
        return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
          if (result instanceof Error) return Promise.reject(result).then(resolve, reject);
          return Promise.resolve(result).then(resolve, reject);
        };
      }
      return (...args: unknown[]) => {
        call.steps.push({ method: String(property), args });
        return chain;
      };
    },
  });
  return chain;
}

function queryFor(): unknown {
  return new Proxy(
    {},
    {
      get: (_target, table) => {
        return new Proxy(
          {},
          {
            get: (_inner, method) => (...args: unknown[]) => {
              const chain = chainFor("select") as Record<string, (...input: unknown[]) => unknown>;
              return chain[`${String(table)}.${String(method)}`]!(...args);
            },
          },
        );
      },
    },
  );
}

export const delegatingDb = new Proxy(
  {},
  {
    get: (_target, property) => {
      if (property === "query") return queryFor();
      if (OPERATIONS.includes(property as FakeDbOperation)) {
        return (...args: unknown[]) => chainFor(property as FakeDbOperation, args);
      }
      return undefined;
    },
  },
);

export function useFakeDb(results: FakeDbResults = {}): void {
  queues = emptyQueues();
  calls = [];
  for (const operation of OPERATIONS) queues[operation] = [...(results[operation] ?? [])];
}

export function dbCalls(operation: FakeDbOperation): FakeDbCall[] {
  return calls.filter((call) => call.operation === operation);
}

export function stepArgs(call: FakeDbCall, method: string): unknown[] | undefined {
  return call.steps.find((step) => step.method === method)?.args;
}
