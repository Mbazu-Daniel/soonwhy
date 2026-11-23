import { createDb, DEFAULT_CAPTURE_SETTINGS, ingestEventReceipts, type Db } from "@soonwhy/shared";
import { resetDatabase } from "@soonwhy/test-support";
import { eq } from "drizzle-orm";
import { mapLogToRow } from "../../src/parse/mappers";
import { IngestReceiptRepository } from "../../src/pipeline/receipt.repository";
import { SHARED_PAYLOAD, SIGNAL } from "./constants";
import type { IngestOrganization } from "./types";

let db: Db | undefined;
let receipts: IngestReceiptRepository | undefined;

function required<Value>(value: Value | undefined): Value {
  if (value === undefined) throw new Error("Call resetReceipts() before using the receipt context");
  return value;
}

export async function resetReceipts(): Promise<void> {
  await resetDatabase();
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  db = createDb(url);
  receipts = new IngestReceiptRepository(db);
}

export const receiptRepository = (): IngestReceiptRepository => required(receipts);

export const eventIdFor = (organization: IngestOrganization): string =>
  mapLogToRow(SHARED_PAYLOAD, { ...organization, captureSettings: DEFAULT_CAPTURE_SETTINGS }).eventId;

export const receiptRow = async (eventId: string) =>
  (await required(db).select().from(ingestEventReceipts).where(eq(ingestEventReceipts.eventId, eventId)))[0];

export const claimAs = (organization: IngestOrganization, eventId: string) =>
  receiptRepository().claimBatch([eventId], organization.organizationId, organization.projectId, SIGNAL);

export async function alreadyStoredOrBusy(organization: IngestOrganization, eventId: string): Promise<string[]> {
  const result = await claimAs(organization, eventId);
  return [...result.committed, ...result.busy];
}
