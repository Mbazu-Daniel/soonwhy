import "../../dotenv";
import { instrumentedDb } from "./instrumented";

export const db = instrumentedDb;
