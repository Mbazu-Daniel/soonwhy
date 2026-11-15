import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const SOURCE = "https://models.dev/api.json";
const TARGET = fileURLToPath(new URL("../src/modules/v1/ai/models-snapshot.json", import.meta.url));

const response = await fetch(SOURCE, { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`models.dev responded with ${response.status}`);
const document = await response.json();

const snapshot = {};
for (const [providerId, provider] of Object.entries(document)) {
  const models = {};
  for (const [modelId, model] of Object.entries(provider.models ?? {})) {
    models[modelId] = {
      name: model.name,
      description: model.description,
      cost: model.cost ? { input: model.cost.input, output: model.cost.output } : undefined,
      limit: model.limit ? { context: model.limit.context, output: model.limit.output } : undefined,
      structured_output: model.structured_output,
      status: model.status,
    };
  }
  snapshot[providerId] = { name: provider.name, api: provider.api, models };
}

await writeFile(TARGET, `${JSON.stringify(snapshot)}\n`);
console.log(`Wrote ${Object.keys(snapshot).length} providers to ${TARGET}`);
