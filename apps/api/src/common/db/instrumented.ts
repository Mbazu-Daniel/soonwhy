import { db } from "./index";
import {
  getDbQueryCount,
  getDbQueryDuration,
} from "../telemetry/otel-metrics";

type QueryLabels = {
  service: string;
  query: string;
  error?: string;
};

function instrumentThenable<T>(
  thenable: T & { then: any },
  queryName: string,
): T & { then: any } {
  const labels: QueryLabels = {
    service: "soonwhy-api",
    query: queryName,
  };

  const originalThen = thenable.then.bind(thenable);
  const wrapped = new Proxy(thenable, {
    get(target, prop: string) {
      if (prop === "then") {
        return (onFulfilled?: any, onRejected?: any) => {
          const start = Date.now();
          return originalThen(
            (result: any) => {
              const duration = Date.now() - start;
              getDbQueryCount().add(1, labels);
              getDbQueryDuration().record(duration, labels);
              return result;
            },
            (err: any) => {
              const duration = Date.now() - start;
              getDbQueryCount().add(1, { ...labels, error: "true" });
              getDbQueryDuration().record(duration, {
                ...labels,
                error: "true",
              });
              throw err;
            },
          );
        };
      }
      return (target as any)[prop];
    },
  }) as T & { then: any };
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

export const instrumentedDb = new Proxy(db, {
  get(target, prop: string) {
    const value = (target as any)[prop];
    if (
      typeof value === "function" &&
      dbMethods.includes(prop as (typeof dbMethods)[number])
    ) {
      return (...args: any[]) => {
        const result = value.apply(target, args);
        if (
          result &&
          typeof result === "object" &&
          typeof (result as any).then === "function"
        ) {
          const queryName = `${String(prop)}:${args?.[0]?.name ?? args?.[0]?.constructor?.name ?? "unknown"}`;
          return instrumentThenable(result, queryName);
        }
        return result;
      };
    }
    return value;
  },
}) as any;

export { schema } from "./index";
