import type {
  Finding,
  Recommendation,
  RecommendationCategory,
  RecommendationPriority,
} from "./recommendation-engine.types";
import { randomUUID } from "node:crypto";

export function generateRecommendations(findings: Finding[]): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const finding of findings) {
    const category = inferCategory(finding);
    const priority = inferPriority(finding);
    const categoryRecommendations = getCategoryRecommendations(
      category,
      finding,
      priority,
    );

    recommendations.push(...categoryRecommendations);
  }

  // Deduplicate by title
  const uniqueRecommendations = new Map<string, Recommendation>();
  for (const rec of recommendations) {
    const key = `${rec.category}:${rec.title}`;
    if (!uniqueRecommendations.has(key) || uniqueRecommendations.get(key)!.confidence < rec.confidence) {
      uniqueRecommendations.set(key, rec);
    }
  }

  return Array.from(uniqueRecommendations.values());
}

function inferCategory(finding: Finding): RecommendationCategory {
  const findingType = finding.findingType.toLowerCase();
  const domain = finding.identity.domain;

  if (domain === "database" || findingType.includes("query") || findingType.includes("n+1")) {
    return "database";
  }
  if (domain === "dependency" || findingType.includes("dependency") || findingType.includes("http")) {
    return "dependency";
  }
  if (domain === "infrastructure" || findingType.includes("cpu") || findingType.includes("memory")) {
    return "infrastructure";
  }
  if (domain === "ai" || findingType.includes("token") || findingType.includes("cost")) {
    return "ai";
  }
  if (domain === "error" || findingType.includes("error")) {
    return "error";
  }
  if (findingType.includes("architecture") || findingType.includes("design")) {
    return "architecture";
  }

  return "performance";
}

function inferPriority(finding: Finding): RecommendationPriority {
  if (finding.severity === "critical") return "critical";
  if (finding.severity === "warning" && finding.confidence > 0.8) return "high";
  if (finding.severity === "warning") return "medium";
  return "low";
}

function getCategoryRecommendations(
  category: RecommendationCategory,
  finding: Finding,
  priority: RecommendationPriority,
): Recommendation[] {
  const baseRecommendation: Omit<Recommendation, "id" | "title" | "description" | "impact" | "expectedSignal"> = {
    category,
    priority,
    effort: "moderate",
    evidence: finding.evidence.map((e, i) => ({
      findingId: `${finding.identity.fingerprint}-${i}`,
      findingType: finding.findingType,
      excerpt: e,
    })),
    confidence: finding.confidence,
    relatedFindings: [finding.identity.fingerprint],
    createdAt: new Date().toISOString(),
  };

  switch (category) {
    case "database":
      return getDatabaseRecommendations(finding, baseRecommendation);
    case "dependency":
      return getDependencyRecommendations(finding, baseRecommendation);
    case "infrastructure":
      return getInfrastructureRecommendations(finding, baseRecommendation);
    case "ai":
      return getAIRecommendations(finding, baseRecommendation);
    case "error":
      return getErrorRecommendations(finding, baseRecommendation);
    case "performance":
      return getPerformanceRecommendations(finding, baseRecommendation);
    default:
      return [];
  }
}

function getDatabaseRecommendations(
  finding: Finding,
  base: Omit<Recommendation, "id" | "title" | "description" | "impact" | "expectedSignal">,
): Recommendation[] {
  const findingType = finding.findingType.toLowerCase();

  if (findingType.includes("n+1")) {
    return [
      {
        ...base,
        id: randomUUID(),
        title: "Batch/preload related records to eliminate N+1 queries",
        description: "The detected N+1 query pattern indicates repeated database calls within a single request. Consider batching queries, preloading related data, or using GraphQL DataLoader patterns.",
        impact: "Reduce database load by 60-80% and improve response latency",
        expectedSignal: {
          metric: "Queries per request",
          before: finding.evidence[0] || "47 queries",
          after: "5-10 queries",
          improvement: "70-90% reduction",
        },
      },
    ];
  }

  if (findingType.includes("slow") || findingType.includes("latency")) {
    return [
      {
        ...base,
        id: randomUUID(),
        title: "Add or optimize database index for slow query",
        description: "The query is exceeding performance thresholds. Review the query execution plan and add appropriate indexes or rewrite the query for better performance.",
        impact: "Reduce query latency by 50-90%",
        expectedSignal: {
          metric: "Query latency (p95)",
          before: finding.evidence[0] || "2000ms",
          after: "200-500ms",
          improvement: "75-90% reduction",
        },
      },
    ];
  }

  if (findingType.includes("large") || findingType.includes("scan")) {
    return [
      {
        ...base,
        id: randomUUID(),
        title: "Optimize query to reduce table scan",
        description: "The query is scanning a large number of rows. Add WHERE clause filters, use appropriate indexes, or implement pagination to reduce the scan size.",
        impact: "Reduce database load and improve query performance",
        expectedSignal: {
          metric: "Rows scanned",
          before: finding.evidence[0] || "100,000 rows",
          after: "1,000-5,000 rows",
          improvement: "95-99% reduction",
        },
      },
    ];
  }

  return [];
}

function getDependencyRecommendations(
  finding: Finding,
  base: Omit<Recommendation, "id" | "title" | "description" | "impact" | "expectedSignal">,
): Recommendation[] {
  const findingType = finding.findingType.toLowerCase();

  if (findingType.includes("latency")) {
    return [
      {
        ...base,
        id: randomUUID(),
        title: "Implement caching for dependency calls",
        description: "External dependency latency is impacting performance. Consider implementing caching with appropriate TTL, using a CDN, or adding circuit breakers.",
        impact: "Reduce dependency latency by 50-80%",
        expectedSignal: {
          metric: "Dependency latency (p95)",
          before: finding.evidence[0] || "500ms",
          after: "50-150ms",
          improvement: "70-90% reduction",
        },
      },
    ];
  }

  if (findingType.includes("error") || findingType.includes("failure")) {
    return [
      {
        ...base,
        id: randomUUID(),
        title: "Add retry logic with exponential backoff",
        description: "Dependency errors are occurring frequently. Implement retry logic with exponential backoff, circuit breakers, and fallback mechanisms to improve resilience.",
        impact: "Reduce error rate by 50-80%",
        expectedSignal: {
          metric: "Dependency error rate",
          before: finding.evidence[0] || "15%",
          after: "2-5%",
          improvement: "70-90% reduction",
        },
      },
    ];
  }

  return [];
}

function getInfrastructureRecommendations(
  finding: Finding,
  base: Omit<Recommendation, "id" | "title" | "description" | "impact" | "expectedSignal">,
): Recommendation[] {
  const findingType = finding.findingType.toLowerCase();

  if (findingType.includes("cpu")) {
    return [
      {
        ...base,
        id: randomUUID(),
        title: "Scale horizontally or optimize CPU-intensive operations",
        description: "CPU saturation is detected. Consider horizontal scaling, offloading CPU-intensive work to background jobs, or optimizing algorithms.",
        impact: "Reduce CPU utilization and improve throughput",
        expectedSignal: {
          metric: "CPU utilization (p95)",
          before: finding.evidence[0] || "92%",
          after: "50-70%",
          improvement: "20-40% reduction",
        },
      },
    ];
  }

  if (findingType.includes("memory")) {
    return [
      {
        ...base,
        id: randomUUID(),
        title: "Investigate memory leaks or increase allocated memory",
        description: "Memory pressure is detected. Investigate for memory leaks, reduce object retention, or increase memory allocation for the service.",
        impact: "Prevent OOM kills and improve stability",
        expectedSignal: {
          metric: "Memory utilization (p95)",
          before: finding.evidence[0] || "89%",
          after: "50-70%",
          improvement: "20-30% reduction",
        },
      },
    ];
  }

  return [];
}

function getAIRecommendations(
  finding: Finding,
  base: Omit<Recommendation, "id" | "title" | "description" | "impact" | "expectedSignal">,
): Recommendation[] {
  const findingType = finding.findingType.toLowerCase();

  if (findingType.includes("token") || findingType.includes("cost")) {
    return [
      {
        ...base,
        id: randomUUID(),
        title: "Optimize prompts or use smaller models for non-critical operations",
        description: "Token usage is exceeding baseline. Consider prompt optimization, using smaller models for simple tasks, or implementing caching for repeated requests.",
        impact: "Reduce AI costs by 30-60%",
        expectedSignal: {
          metric: "Tokens per minute",
          before: finding.evidence[0] || "50,000",
          after: "20,000-30,000",
          improvement: "40-60% reduction",
        },
      },
    ];
  }

  if (findingType.includes("latency")) {
    return [
      {
        ...base,
        id: randomUUID(),
        title: "Use streaming responses or cache model outputs",
        description: "AI operation latency is high. Consider using streaming responses, caching model outputs, or switching to faster models for time-sensitive operations.",
        impact: "Reduce AI latency by 30-50%",
        expectedSignal: {
          metric: "AI operation latency (p95)",
          before: finding.evidence[0] || "3000ms",
          after: "1500-2000ms",
          improvement: "30-50% reduction",
        },
      },
    ];
  }

  return [];
}

function getErrorRecommendations(
  finding: Finding,
  base: Omit<Recommendation, "id" | "title" | "description" | "impact" | "expectedSignal">,
): Recommendation[] {
  return [
    {
      ...base,
      id: randomUUID(),
      title: "Add error handling and monitoring for the affected code path",
      description: "Errors are occurring in the detected code path. Add proper error handling, logging, and monitoring to prevent cascading failures and improve debuggability.",
      impact: "Reduce error rate and improve system stability",
      expectedSignal: {
        metric: "Error rate",
        before: finding.evidence[0] || "5%",
        after: "0.5-1%",
        improvement: "80-90% reduction",
      },
    },
  ];
}

function getPerformanceRecommendations(
  finding: Finding,
  base: Omit<Recommendation, "id" | "title" | "description" | "impact" | "expectedSignal">,
): Recommendation[] {
  const findingType = finding.findingType.toLowerCase();

  if (findingType.includes("latency")) {
    return [
      {
        ...base,
        id: randomUUID(),
        title: "Profile and optimize the slow operation",
        description: "Latency regression detected. Profile the operation to identify bottlenecks, optimize algorithms, or consider caching results.",
        impact: "Improve response time and user experience",
        expectedSignal: {
          metric: "Endpoint latency (p95)",
          before: finding.evidence[0] || "2000ms",
          after: "500-800ms",
          improvement: "60-75% reduction",
        },
      },
    ];
  }

  if (findingType.includes("throughput")) {
    return [
      {
        ...base,
        id: randomUUID(),
        title: "Scale horizontally or optimize for higher throughput",
        description: "Throughput degradation detected. Consider horizontal scaling, connection pooling optimization, or reducing per-request work.",
        impact: "Increase system capacity and handle more requests",
        expectedSignal: {
          metric: "Requests per second",
          before: finding.evidence[0] || "100 req/s",
          after: "200-300 req/s",
          improvement: "100-200% increase",
        },
      },
    ];
  }

  return [];
}
