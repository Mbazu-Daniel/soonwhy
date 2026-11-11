import { createHash } from "node:crypto";
import type {
  QueryIdentity,
  QueryEvidence,
} from "./query-intelligence.types";

const QUERY_FINGERPRINT_VERSION = 2;

/**
 * Advanced SQL normalization for query fingerprinting.
 *
 * This normalizer handles:
 * - Whitespace and case normalization
 * - Comment removal (SQL and C-style)
 * - String literal replacement
 * - Numeric literal replacement
 * - IN (...) clause cardinality tracking
 * - Parameter normalization (?1, $1, :param)
 * - Table name extraction
 * - ORM-generated query normalization
 */
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

  // Remove SQL comments (--)
  normalized = normalized.replace(/--[^\r\n]*/g, " ");

  // Remove C-style comments (/* */)
  normalized = normalized.replace(/\/\*[\s\S]*?\*\//g, " ");

  // Extract table names before normalization
  const tableNames = extractTableNames(normalized);

  // Track IN clause cardinalities
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

  // Replace string literals (single-quoted)
  normalized = normalized.replace(/'(?:''|[^'])*'/g, "?");

  // Replace string literals (double-quoted, except for identifiers)
  normalized = normalized.replace(/"(?:""|[^"])*"/g, "?");

  // Replace numeric literals
  normalized = normalized.replace(/\b\d+(?:\.\d+)?\b/g, "?");

  // Normalize named parameters (:param, $param, @param)
  normalized = normalized.replace(/[:$@]\w+/g, "?");

  // Normalize positional parameters (?1, $1)
  normalized = normalized.replace(/\?[0-9]+/g, "?");
  normalized = normalized.replace(/\$[0-9]+/g, "?");

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, " ").trim().toLowerCase();

  // Count parameters
  const parameterCount = (normalized.match(/\?/g) || []).length;

  // Generate fingerprint
  const fingerprint = createHash("sha256")
    .update(`${QUERY_FINGERPRINT_VERSION}:${databaseSystem ?? ""}:${normalized}`)
    .digest("hex");

  // Estimate cardinality based on patterns
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

/**
 * Extract table names from a SQL query.
 *
 * This is a simple heuristic-based extraction that works for common patterns.
 * It's not a full SQL parser but handles most cases.
 */
function extractTableNames(query: string): string[] {
  const tables = new Set<string>();
  const lowerQuery = query.toLowerCase();

  // FROM clause
  const fromMatch = lowerQuery.match(/\bfrom\s+([^\s;]+)(?:\s+as\s+(\w+))?/i);
  if (fromMatch && fromMatch[1]) {
    tables.add(fromMatch[1]);
  }

  // JOIN clauses
  const joinMatches = lowerQuery.matchAll(
    /\b(?:inner|left|right|full|cross)?\s*join\s+([^\s;]+)(?:\s+as\s+(\w+))?/gi,
  );
  for (const match of joinMatches) {
    if (match[1]) tables.add(match[1]);
  }

  // UPDATE clause
  const updateMatch = lowerQuery.match(/\bupdate\s+([^\s;]+)/i);
  if (updateMatch && updateMatch[1]) {
    tables.add(updateMatch[1]);
  }

  // INSERT INTO clause
  const insertMatch = lowerQuery.match(/\binsert\s+into\s+([^\s;]+)/i);
  if (insertMatch && insertMatch[1]) {
    tables.add(insertMatch[1]);
  }

  // DELETE FROM clause
  const deleteMatch = lowerQuery.match(/\bdelete\s+from\s+([^\s;]+)/i);
  if (deleteMatch && deleteMatch[1]) {
    tables.add(deleteMatch[1]);
  }

  return Array.from(tables);
}

/**
 * Estimate query cardinality based on patterns.
 */
function estimateCardinality(
  normalized: string,
  listCardinalities: number[],
  parameterCount: number,
): "low" | "medium" | "high" {
  // High cardinality indicators
  if (normalized.includes("in (?)") && listCardinalities.some((c) => c > 100)) {
    return "high";
  }

  if (parameterCount > 10) {
    return "high";
  }

  if (normalized.includes("like") || normalized.includes("regexp")) {
    return "high";
  }

  // Medium cardinality indicators
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

/**
 * Normalize ORM-generated queries.
 *
 * Handles common patterns from ORMs like:
 * - Drizzle: SELECT ... FROM "table" WHERE "table"."id" = $1
 * - Prisma: SELECT ... FROM "User" WHERE "id" = ?
 * - TypeORM: SELECT ... FROM user WHERE id = ?
 */
export function normalizeOrmQuery(
  query: string,
  orm?: "drizzle" | "prisma" | "typeorm" | "sequelize" | "knex",
): { identity: QueryIdentity; evidence: QueryEvidence } {
  let normalized = query;

  // Drizzle-specific: quoted identifiers
  if (orm === "drizzle") {
    normalized = normalized.replace(/"([^"]+)"/g, (match, identifier) => {
      // Keep quotes for reserved keywords, remove for regular identifiers
      const reserved = ["select", "from", "where", "join", "order", "group", "by", "and", "or", "not", "in", "like"];
      if (reserved.includes(identifier.toLowerCase())) {
        return match;
      }
      return identifier;
    });
  }

  // Prisma-specific: table aliases and casts
  if (orm === "prisma") {
    normalized = normalized.replace(/"(\w+)"\."(\w+)"/g, "$1.$2");
  }

  // Apply general normalization
  return normalizeQuery(normalized);
}
