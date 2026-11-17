import "reflect-metadata";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";

type StandardSchema = { "~standard": { validate: (value: unknown) => unknown } };

type ParameterEntry = { index: number; schema?: StandardSchema };

export async function validateBody(controller: Function, handlerName: string, body: unknown): Promise<{ valid: boolean }> {
  const entries = Object.values(
    (Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, handlerName) ?? {}) as Record<string, ParameterEntry>,
  );
  const entry = entries.find((candidate) => candidate.schema);
  if (!entry?.schema) throw new Error(`${controller.name}.${handlerName} has no body schema`);
  const result = (await entry.schema["~standard"].validate(body)) as { issues?: unknown[] };
  return { valid: !result.issues };
}
