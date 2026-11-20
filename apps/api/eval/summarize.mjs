import { readFileSync } from "node:fs";
const { rows } = JSON.parse(readFileSync(new URL(process.argv[2] ?? "./results/accuracy.json", import.meta.url)));
const faults = rows.filter((r) => r.target);
const normals = rows.filter((r) => !r.target);
const M = ["full", "anomalyOnly", "criticalPathOnly", "firstError"];
const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) : "-");
const med = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
const out = {};
const groups = { all: faults, ...Object.fromEntries([...new Set(faults.map((r) => r.scenario))].map((s) => [s, faults.filter((r) => r.scenario === s)])) };
for (const [g, rs] of Object.entries(groups)) {
  out[g] = { n: rs.length, detected: pct(rs.filter((r) => r.detected).length, rs.length), medDetectMs: med(rs.map((r) => r.detectionMs)), medReq: med(rs.map((r) => r.requestsToDetect)) };
  for (const m of M) for (const phase of ["initial", "final"]) {
    const ranks = rs.map((r) => r[`${m}_${phase}Rank`]);
    out[g][`${m}_${phase}`] = { top1: pct(ranks.filter((x) => x === 1).length, rs.length), top3: pct(ranks.filter((x) => x != null && x <= 3).length, rs.length) };
  }
}
out.falseAlarmRuns = { n: normals.length, any: normals.filter((r) => r.detected || r.preOnsetFinding).length };
out.preOnsetInFaultRuns = faults.filter((r) => r.preOnsetFinding).length;
console.log(JSON.stringify(out, null, 1));
