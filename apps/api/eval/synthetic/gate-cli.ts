import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { evaluateGate, makeBaseline, renderGate } from "./gate";
import type { Baseline } from "./gate.types";
import type { RunRow } from "./types";

const RESULTS_DIR = new URL("../results/synthetic/", import.meta.url).pathname;

const rowsFor = (suffix: string): RunRow[] =>
  readdirSync(RESULTS_DIR)
    .filter((name) => name.startsWith("rows-") && name.endsWith(`-${suffix}.json`))
    .flatMap((name) => JSON.parse(readFileSync(`${RESULTS_DIR}${name}`, "utf8")) as RunRow[]);

const [mode, suffix, file] = process.argv.slice(2);
if (!mode || !suffix || !file) throw new Error("usage: gate-cli.ts <check|baseline> <results-suffix> <baseline-file>");

const rows = rowsFor(suffix);
if (rows.length === 0) throw new Error(`no result rows found for "${suffix}" in ${RESULTS_DIR}`);

if (mode === "baseline") {
  const baseline = makeBaseline(rows, suffix, "Per-scenario results of the synthetic suite. Change only by a deliberate commit.");
  writeFileSync(file, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`wrote ${file} from ${rows.length} runs`);
} else {
  const result = evaluateGate(rows, JSON.parse(readFileSync(file, "utf8")) as Baseline);
  console.log(renderGate(result));
  process.exitCode = result.passed ? 0 : 1;
}
