import type { FindingCategory } from "../../../../../common/db/schema/finding-lifecycle";
import type { FindingType } from "../../detections/domain/detection.types";

export const FINDING_KINDS: Record<FindingType, { category: FindingCategory; recommendation: string }> = {
  latency: {
    category: "performance",
    recommendation: "Find the slowest endpoints in the evidence, open a sample trace and fix the longest span. Check for missing indexes, serial calls that could run in parallel, and cold caches.",
  },
  error_rate: {
    category: "error",
    recommendation: "Open the failing requests in the evidence and group them by route and status. Fix the most frequent cause first. Add a test that reproduces it.",
  },
  throughput: {
    category: "performance",
    recommendation: "Compare the drop or spike against recent deploys and upstream traffic. Check the load balancer, queue depth and instance count before changing code.",
  },
  dependency_latency: {
    category: "performance",
    recommendation: "The slowdown comes from a downstream call. Add a timeout, a retry with backoff and a circuit breaker. Check the dependency's own status.",
  },
  trace_span: {
    category: "performance",
    recommendation: "One span dominates the trace. Open the sample trace, look at what the span waits on, and remove or batch the work.",
  },
  bottleneck: {
    category: "performance",
    recommendation: "One step limits the whole request. Optimise that step or move it off the request path.",
  },
  error_group: {
    category: "error",
    recommendation: "Open the top stack frame, reproduce with the sample trace, ship a fix with a regression test. Mark it resolved after the deploy. It reopens if the error returns.",
  },
  database_query: {
    category: "performance",
    recommendation: "Run EXPLAIN on the query in the evidence. Add the missing index or rewrite it to read fewer rows.",
  },
  database_n_plus_one: {
    category: "performance",
    recommendation: "The same query repeats once per row. Load the related rows in one query with a join or an IN list, or use the ORM's eager loading.",
  },
  database_query_volume: {
    category: "performance",
    recommendation: "The request issues too many queries. Batch them, cache repeated reads, and remove queries inside loops.",
  },
  database_error: {
    category: "error",
    recommendation: "Read the database error in the evidence. Check for deadlocks, constraint violations and bad parameters, then fix the query or the data.",
  },
  database_latency_contribution: {
    category: "performance",
    recommendation: "The database accounts for most of the request time. Fix the slowest queries listed in the evidence first.",
  },
  database_connection_pool: {
    category: "performance",
    recommendation: "The pool is exhausted. Release connections promptly, shorten transactions, and size the pool to the database's limit.",
  },
  database_connection_wait: {
    category: "performance",
    recommendation: "Requests wait for a free connection. Raise the pool size only if the database has headroom. Otherwise shorten the queries holding connections.",
  },
  database_batch: {
    category: "performance",
    recommendation: "Writes run one at a time. Group them into batch inserts or updates inside one transaction.",
  },
  database_dependency_degradation: {
    category: "performance",
    recommendation: "The database is slower than its baseline. Check load, locks, replication lag and recent schema or deploy changes.",
  },
  database_result_set: {
    category: "performance",
    recommendation: "The query returns far more rows than the code uses. Add a limit, a filter, or select only the columns you need.",
  },
  database_timeout: {
    category: "performance",
    recommendation: "Queries hit the timeout. Find the slow query, add an index, and set a statement timeout so one query cannot hold the pool.",
  },
  database_lock_contention: {
    category: "performance",
    recommendation: "Transactions wait on each other's locks. Keep transactions short, update rows in a consistent order, and avoid long-running writes.",
  },
  external_dependency_degradation: {
    category: "performance",
    recommendation: "A third-party service is slow or failing. Add timeouts, retries with backoff, a fallback and a circuit breaker.",
  },
  redis_degradation: {
    category: "performance",
    recommendation: "Redis is slow or failing. Check memory, eviction, slow commands and connection count. Avoid large keys and blocking commands.",
  },
  queue_degradation: {
    category: "performance",
    recommendation: "The queue is backing up. Check consumer count, failing jobs and processing time. Scale consumers or fix the failing job.",
  },
  runtime_degradation: {
    category: "performance",
    recommendation: "The runtime is under pressure. Check memory growth, event-loop lag and garbage collection. Look for leaks and blocking work.",
  },
  seasonal_anomaly: {
    category: "performance",
    recommendation: "The value is outside its usual daily or weekly pattern. Check for a deploy, a traffic source change or an upstream incident at that time.",
  },
  change_point: {
    category: "performance",
    recommendation: "The metric shifted at a specific time. Compare that time against deploys and config changes, and roll back the change if it matches.",
  },
  auth_failure_spike: {
    category: "security",
    recommendation: "Check whether the failures come from one IP, user or key. Block or rate-limit the source, rotate any credential that may have leaked, and confirm that a deploy did not break token validation.",
  },
  secret_in_logs: {
    category: "security",
    recommendation: "Rotate the exposed credential now. Then stop logging it: redact secrets and authorization headers in the logger, and delete or restrict the log lines that already contain it.",
  },
  sensitive_data_exposure: {
    category: "security",
    recommendation: "Stop returning this field. Remove it from the response model or the serializer, so it is never sent to the client. If it was already exposed, rotate any credential it carried and check who called this route.",
  },
  alert_rule: {
    category: "performance",
    recommendation: "Your alert rule fired. Check the metric in the evidence against recent deploys and traffic, decide whether it is a real problem, then mark this finding resolved or ignore it.",
  },
};
