import { databaseTestsEnabled } from "./database-enabled";
import { testDatabaseUrl } from "./database-url";

if (databaseTestsEnabled) {
  process.env.DATABASE_URL = testDatabaseUrl();
}
