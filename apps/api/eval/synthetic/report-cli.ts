import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildReport } from "./report";
import { renderReport } from "./render";
import type { RunRow } from "./types";

const RESULTS_DIR = new URL("../results/synthetic/", import.meta.url).pathname;

const rowsFor = (split: string): RunRow[] =>
  readdirSync(RESULTS_DIR)
    .filter((name) => name.startsWith("rows-") && name.endsWith(`-${split}.json`))
    .flatMap((name) => JSON.parse(readFileSync(`${RESULTS_DIR}${name}`, "utf8")) as RunRow[]);

const split = process.argv[2] ?? "tuning";
const rows = rowsFor(split);
const tuning = existsSync(RESULTS_DIR) ? rowsFor("tuning") : [];
const report = buildReport(rows, split, tuning.length > 0 ? tuning : rows);
writeFileSync(`${RESULTS_DIR}report-${split}.json`, JSON.stringify(report, null, 2));
writeFileSync(`${RESULTS_DIR}report-${split}.md`, renderReport(report));
console.log(renderReport(report));
