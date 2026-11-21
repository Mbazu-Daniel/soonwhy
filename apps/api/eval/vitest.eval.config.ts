import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["eval/**/*.eval.ts"],
    testTimeout: 3_600_000,
    hookTimeout: 120_000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
  },
});
