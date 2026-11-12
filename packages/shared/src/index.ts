export { NatsService, type NatsMessageHandler, type NatsServiceOptions } from "./nats/service";
export { generateEventId } from "./telemetry-identity/event-id";
export { RateLimiter } from "./redis/rate-limit";
export {
  type CaptureSettings,
  DEFAULT_CAPTURE_SETTINGS,
  resolveCaptureSettings,
} from "./capture-settings";
export {
  encryptPii,
  decryptPii,
  isPiiKey,
  isPiiValue,
  isPiiAttribute,
  encryptPiiInText,
} from "./privacy/pii";
export { apiKeys, deadLetterQueue, ingestEventReceipts, projects, projectSettings } from "./db/schema";
export { createDb, type Db, DB, schema } from "./db";
export { ApiKeysService, apiKeyFromAuthorization } from "./auth/api-keys";
export type { ValidatedApiKey } from "./auth/api-keys.types";
export {
  QuickwitService,
  type QuickwitHit,
  type QuickwitSearchInput,
  type QuickwitSearchResponse,
} from "./quickwit";
export { QUICKWIT_INDEXES, QUICKWIT_INDEX_CONFIG } from "./quickwit/config";
export {
  WeeklySummaryService,
  type WeeklySummaryServiceDeps,
} from "./weekly-summary";
export * from "./telemetry-identity";
