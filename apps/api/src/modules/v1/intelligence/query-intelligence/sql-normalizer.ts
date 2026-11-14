import { createHash } from "node:crypto";
import type {
  QueryIdentity,
  QueryEvidence,
} from "./query-intelligence.types";

const QUERY_FINGERPRINT_VERSION = 2;

export function normalizeQuery(
  query: string,
  databaseSystem?: string,
): { identity: QueryIdentity; evidence: QueryEvidence } {
  const rawQuery = query.trim();
  if (!rawQuery) {
    return {
      identity: {
        fingerprint: "",
        fingerprintVersion: QUERY_FINGERPRINT_VERSION,
        databaseSystem,
        operation: "",
        normalizedQuery: "",
      },
      evidence: {
        rawQuery: query,
        listCardinalities: [],
        parameterCount: 0,
        tableNames: [],
        estimatedCardinality: "low",
      },
    };
  }

  let normalized = rawQuery;

  normalized = normalized.replace(/--[^\r\n]*/g, " ");

  normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, " ");

  const tableNames = extractTableNames(normalized);

  const listCardinalities: number[] = [];
  normalized = normalized.replace(
    /\bIN\s*\(([^()]*)\)/gi,
    (_match, contents: string) => {
      const values = contents
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      listCardinalities.push(values.length);
      return "IN (?)";
    },
  );

  normalized = normalized.replace(/'(?:''|[^'])*'/g, "?");

  normalized = normalized.replace(/"(?:""|[^"])*"/g, "?");

  normalized = normalized.replace(/\b\d+(?:\.\d+)?\b/g, "?");

  normalized = normalized.replace(/[:$@]\w+/g, "?");

  normalized = normalized.replace(/\?[0-9]+/g, "?");
  normalized = normalized.replace(/\$[0-9]+/g, "?");

  normalized = normalized.replace(/\s+/g, " ").trim().toLowerCase();

  const parameterCount = (normalized.match(/\?/g) || []).length;

  const fingerprint = createHash("sha256")
    .update(`${QUERY_FINGERPRINT_VERSION}:${databaseSystem ?? ""}:${normalized}`)
    .digest("hex");

  const estimatedCardinality = estimateCardinality(
    normalized,
    listCardinalities,
    parameterCount,
  );

  return {
    identity: {
      fingerprint,
      fingerprintVersion: QUERY_FINGERPRINT_VERSION,
      databaseSystem,
      operation: normalized,
      normalizedQuery: normalized,
    },
    evidence: {
      rawQuery: query,
      listCardinalities,
      parameterCount,
      tableNames,
      estimatedCardinality,
    },
  };
}

function extractTableNames(query: string): string[] {
  const tables = new Set<string>();
  const lowerQuery = query.toLowerCase();

  const fromMatch = lowerQuery.match(/\bfrom\s+([^\s;]+)(?:\s+as\s+(\w+))?/i);
  if (fromMatch && fromMatch[1]) {
    tables.add(fromMatch[1]);
  }

  const joinMatches = lowerQuery.matchAll(
    /\b(?:inner|left|right|full|cross)?\s*join\s+([^\s;]+)(?:\s+as\s+(\w+))?/gi,
  );
  for (const match of joinMatches) {
    if (match[1]) tables.add(match[1]);
  }

  const updateMatch = lowerQuery.match(/\bupdate\s+([^\s;]+)/i);
  if (updateMatch && updateMatch[1]) {
    tables.add(updateMatch[1]);
  }

  const insertMatch = lowerQuery.match(/\binsert\s+into\s+([^\s;]+)/i);
  if (insertMatch && insertMatch[1]) {
    tables.add(insertMatch[1]);
  }

  const deleteMatch = lowerQuery.match(/\bdelete\s+from\s+([^\s;]+)/i);
  if (deleteMatch && deleteMatch[1]) {
    tables.add(deleteMatch[1]);
  }

  return Array.from(tables);
}

function estimateCardinality(
  normalized: string,
  listCardinalities: number[],
  parameterCount: number,
): "low" | "medium" | "high" {
  if (normalized.includes("in (?)") && listCardinalities.some((c) => c > 100)) {
    return "high";
  }

  if (parameterCount > 10) {
    return "high";
  }

  if (normalized.includes("like") || normalized.includes("regexp")) {
    return "high";
  }

  if (listCardinalities.some((c) => c > 10)) {
    return "medium";
  }

  if (parameterCount > 5) {
    return "medium";
  }

  if (normalized.includes("group by") || normalized.includes("order by")) {
    return "medium";
  }

  return "low";
}

export function normalizeOrmQuery(
  query: string,
  orm?: "drizzle" | "prisma" | "typeorm" | "sequelize" | "knex",
): { identity: QueryIdentity; evidence: QueryEvidence } {
  let normalized = query;

  if (orm === "drizzle") {
    normalized = normalized.replace(/"([^"]+)"/g, (match, identifier) => {
      const reserved = ["select", "from", "where", "join", "order", "group", "by", "and", "or", "not", "in", "like"];
      if (reserved.includes(identifier.toLowerCase())) {
        return match;
      }
      return identifier;
    });
  }

  if (orm === "prisma") {
    normalized = normalized.replace(/"(\w+)"\."(\w+)"/g, "$1.$2");
  }

  return normalizeQuery(normalized);
}
