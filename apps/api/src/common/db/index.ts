import "../../dotenv";
import { instrumentedDb } from "./instrumented";
import * as schema from "./schema";

export const db = instrumentedDb;
export { rawDb } from "./client";
export { instrumentedDb } from "./instrumented";
export { schema };
