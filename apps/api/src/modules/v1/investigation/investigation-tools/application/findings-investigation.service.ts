import { Inject, Injectable } from "@nestjs/common";
import type { z } from "zod4";
import { DetectionService } from "../../../detection/detections/application/detection.service";
import { clip } from "../domain/clip";
import { gather } from "../domain/evidence-result";
import { listFindingsSchema } from "../infrastructure/investigation-tools.schemas";
import type { ToolScope } from "../domain/investigation-tools.types";

@Injectable()
export class FindingsInvestigation {
  constructor(@Inject(DetectionService) private readonly detections: DetectionService) {}

  list({ orgId, projectId }: ToolScope, args: z.infer<typeof listFindingsSchema>) {
    return gather(async () => {
      const rows = await this.detections.list(orgId, projectId, args.limit);
      return {
        truncated: rows.length >= args.limit,
        items: rows.map((row) => ({
          id: row.id,
          type: row.type,
          category: row.category,
          status: row.status,
          severity: row.severity,
          description: clip(row.description, 500),
          observedValue: row.observedValue,
          threshold: row.threshold,
          unit: row.unit,
          windowStart: row.windowStart,
          windowEnd: row.windowEnd,
          detectedAt: row.detectedAt,
          evidence: row.evidence.slice(0, 10).map((item) => ({ ...item, value: typeof item.value === "string" ? clip(item.value, 800) : item.value })),
        })),
      };
    }, "No findings have been detected for this project.");
  }
}
