import { Module } from "@nestjs/common";
import { DrizzleIdempotencyStore } from "./drizzle-idempotency.store";

@Module({
  providers: [DrizzleIdempotencyStore],
})
export class DrizzleIdempotencyModule {}
