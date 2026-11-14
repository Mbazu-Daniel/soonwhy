import { afterAll, afterEach, beforeEach, describe, it, vi } from "vitest";
import { IdempotencyStorage } from "@nestjs/idempotency";
import { idempotencyStoreContract } from "@nestjs/idempotency/testing";
import { DrizzleIdempotencyStore } from "../../src/common/idempotency/drizzle-idempotency.store";
import {
  closeDatabase,
  databaseTestsEnabled,
  resetDatabase,
} from "../support/test-database";

describe.skipIf(!databaseTestsEnabled)("DrizzleIdempotencyStore", () => {
  beforeEach(resetDatabase);
  afterAll(closeDatabase);

  const createStore = () => new DrizzleIdempotencyStore(new IdempotencyStorage());

  describe("the IdempotencyStore contract", () => {
    beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
    afterEach(() => vi.useRealTimers());

    const cases = idempotencyStoreContract(createStore, {
      advanceTime: (ms) => vi.setSystemTime(Date.now() + ms),
      concurrent: true,
    });
    for (const contractCase of cases) {
      it(contractCase.name, contractCase.run, 20_000);
    }
  });
});
