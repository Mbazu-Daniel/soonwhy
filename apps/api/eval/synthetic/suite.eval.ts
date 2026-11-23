import { mkdirSync, writeFileSync } from "node:fs";
import { setImmediate as yieldToEventLoop } from "node:timers/promises";
import { describe, it } from "vitest";
import { runCase, splitOf } from "./run-case";
import { controlReps, maxReps, selectedScenarios, selectedSplit, selectedTopologies } from "./select";
import type { RunRow } from "./types";

const RESULTS_DIR = new URL("../results/synthetic/", import.meta.url).pathname;

describe("synthetic root-cause evaluation", () => {
  for (const topology of selectedTopologies()) {
    it(`runs every selected scenario on ${topology.name}`, { timeout: 7_200_000 }, async () => {
      const split = selectedSplit();
      const rows: RunRow[] = [];
      for (const scenario of selectedScenarios()) {
        for (const spec of scenario.build(topology)) {
          const limit = spec.truth.length === 0 ? controlReps(scenario.reps) : Math.min(scenario.reps, maxReps());
          for (let rep = 0; rep < limit; rep++) {
            if (split !== "all" && splitOf(rep) !== split) continue;
            rows.push(runCase(topology, spec, scenario.name, rep));
            await yieldToEventLoop();
          }
        }
        console.log(`${topology.name}/${scenario.name} done (${rows.length} runs so far)`);
      }
      mkdirSync(RESULTS_DIR, { recursive: true });
      const tag = process.env.EVAL_TAG ?? "";
      writeFileSync(`${RESULTS_DIR}rows-${topology.name}-${split}${tag}.json`, JSON.stringify(rows));
    });
  }
});
