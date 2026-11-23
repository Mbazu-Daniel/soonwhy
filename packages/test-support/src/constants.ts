import { fileURLToPath } from "node:url";

export const DEFAULT_SOURCE_DATABASE_URL = "postgres://soonwhy:soonwhy@localhost:5433/soonwhy";
export const DEFAULT_TEST_DATABASE_NAME = "soonwhy_test";
export const ADMIN_DATABASE_NAME = "postgres";
export const DATABASE_NAME_PATTERN = /^[a-zA-Z0-9_]+$/;
export const TEST_DATABASE_NAME_PATTERN = /test/i;
export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../../apps/api/drizzle", import.meta.url));
