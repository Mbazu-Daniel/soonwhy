import { mkdirSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { SOAK_HOURS } from "./constants";
import { selectedTopologies } from "./select";
import { runSoak } from "./soak";

const RESULTS_DIR = new URL("../results/synthetic/", import.meta.url).pathname;

describe("synthetic soak", () => {
  for (const topology of selectedTopologies()) {
    it(`reports false findings per hour on ${topology.name}`, { timeout: 7_200_000 }, () => {
      const result = runSoak(topology, Number(process.env.EVAL_SOAK_HOURS ?? SOAK_HOURS));
      console.log(JSON.stringify(result));
      mkdirSync(RESULTS_DIR, { recursive: true });
      writeFileSync(`${RESULTS_DIR}soak-${topology.name}.json`, JSON.stringify(result));
    });
  }
});
