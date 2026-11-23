import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.integration.test.ts"],
    globalSetup: ["../test-support/src/global-setup.ts"],
    setupFiles: ["../test-support/src/use-test-database-env.ts"],
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
