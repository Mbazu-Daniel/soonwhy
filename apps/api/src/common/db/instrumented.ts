import { rawDb } from "./client";
import {
  getDbQueryCount,
  getDbQueryDuration,
} from "../telemetry/otel-metrics";

type QueryLabels = {
  service: string;
  query: string;
  error?: string;
};

type Thenable<T> = T & { then: PromiseLike<T>["then"] };

function recordQuery(labels: QueryLabels, startedAt: number): void {
  const duration = Date.now() - startedAt;
  getDbQueryCount().add(1, labels);
  getDbQueryDuration().record(duration, labels);
}

function instrumentThenable<T>(thenable: Thenable<T>, queryName: string): T {
  const labels: QueryLabels = {
    service: "soonwhy-api",
    query: queryName,
  };
  const originalThen = thenable.then.bind(thenable);

  const wrapped = new Proxy(thenable, {
    get(target, prop: string | symbol) {
      if (prop === "then") {
        return <TResult1 = T, TResult2 = never>(
          onFulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
          onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
        ) => {
          const startedAt = Date.now();
          return originalThen(
            (value: T) => {
              recordQuery(labels, startedAt);
              return onFulfilled
                ? onFulfilled(value)
                : (value as unknown as TResult1);
            },
            (error: unknown) => {
              recordQuery({ ...labels, error: "true" }, startedAt);
              if (onRejected) {
                return onRejected(error);
              }
              throw error;
            },
          );
        };
      }
      return (target as Record<string | symbol, unknown>)[prop];
    },
  }) as T;
  return wrapped;
}

const dbMethods = [
  "select",
  "insert",
  "update",
  "delete",
  "execute",
  "transaction",
] as const;

export const instrumentedDb: typeof rawDb = new Proxy(rawDb, {
  get(target, prop: string | symbol) {
    const value = (target as unknown as Record<string | symbol, unknown>)[prop];
    if (
      typeof value === "function" &&
      dbMethods.includes(prop as (typeof dbMethods)[number])
    ) {
      return (...args: any[]) => {
        const result = value.apply(target, args);
        if (
          result &&
          typeof result === "object" &&
          typeof (result as { then?: unknown }).then === "function"
        ) {
          const queryName = `${String(prop)}:${args?.[0]?.name ?? args?.[0]?.constructor?.name ?? "unknown"}`;
          return instrumentThenable(result as Thenable<unknown>, queryName);
        }
        return result;
      };
    }
    return value;
  },
}) as typeof rawDb;
