import { spawn } from "node:child_process";
import postgres from "postgres";
import { dedupeSlugs } from "./dedupe-slugs";

const LOCK_KEY = 7_262_001;

const FAILURE_PATTERN = /^Error:|Interactive prompts require|\bfailed\b/im;

function runPush(allowDataLoss: boolean): Promise<number> {
  const args = ["push", ...(allowDataLoss ? ["--force"] : [])];
  return new Promise((resolve) => {
    let output = "";
    const child = spawn("./node_modules/.bin/drizzle-kit", args, { stdio: ["ignore", "pipe", "pipe"] });
    const forward = (stream: NodeJS.WriteStream) => (chunk: Buffer) => {
      output += chunk.toString();
      stream.write(chunk);
    };
    child.stdout.on("data", forward(process.stdout));
    child.stderr.on("data", forward(process.stderr));
    child.on("error", () => resolve(1));
    child.on("close", (code) => resolve(code === 0 && !FAILURE_PATTERN.test(output) ? 0 : code || 1));
  });
}

async function syncSchema(): Promise<number> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const allowDataLoss = process.env.ALLOW_SCHEMA_DATA_LOSS === "true";
  const client = postgres(connectionString, { max: 1 });
  try {
    await client`select pg_advisory_lock(${LOCK_KEY})`;
    const renamed = await dedupeSlugs(client);
    if (renamed > 0) console.warn(`Renamed ${renamed} duplicate slugs so the unique slug indexes can be created.`);
    const code = await runPush(allowDataLoss);
    if (code !== 0 && !allowDataLoss) {
      console.error(
        "Schema sync stopped. If the change drops or rewrites data, review it, then deploy once with ALLOW_SCHEMA_DATA_LOSS=true.",
      );
    }
    return code;
  } finally {
    await client`select pg_advisory_unlock(${LOCK_KEY})`.catch(() => undefined);
    await client.end();
  }
}

syncSchema()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error("Schema sync failed:", error);
    process.exit(1);
  });
