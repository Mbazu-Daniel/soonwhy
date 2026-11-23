import { defineResource, type IsolationResource } from "@soonwhy/test-support";
import { alreadyStoredOrBusy, claimAs, eventIdFor, receiptRepository, receiptRow } from "./receipt-context";
import type { IngestOrganization, ReceiptRef } from "./types";

const resource: IsolationResource<IngestOrganization, ReceiptRef> = {
  name: "ingest receipts (the same event sent by two organizations)",
  seed: async (victim) => {
    await claimAs(victim, eventIdFor(victim));
    return { eventId: eventIdFor(victim), owner: victim };
  },
  intact: async (ref) => {
    const row = await receiptRow(ref.eventId);
    return row?.status === "pending" && row.organizationId === ref.owner.organizationId && row.projectId === ref.owner.projectId;
  },
  cases: {
    read: {
      attempts: ({ actor }) => ({ "identical payload sent by the actor": () => alreadyStoredOrBusy(actor, eventIdFor(actor)) }),
      owner: ({ owner, ref }) => alreadyStoredOrBusy(owner, ref.eventId),
    },
    update: {
      checksResult: false,
      attempts: ({ actor, ref }) => ({
        "commit the actor's identical payload": () => receiptRepository().commitBatch([eventIdFor(actor)], actor.organizationId),
        "commit the other organization's receipt as the actor": () => receiptRepository().commitBatch([ref.eventId], actor.organizationId),
        "claim the other organization's event id as the actor": async () => (await claimAs(actor, ref.eventId)).claimed,
      }),
      owner: ({ owner, ref }) => receiptRepository().commitBatch([ref.eventId], owner.organizationId),
    },
    delete: {
      checksResult: false,
      attempts: ({ actor, ref }) => ({
        "release the actor's identical payload": () => receiptRepository().releaseBatch([eventIdFor(actor)], actor.organizationId),
        "release the other organization's receipt as the actor": () => receiptRepository().releaseBatch([ref.eventId], actor.organizationId),
      }),
      owner: ({ owner, ref }) => receiptRepository().releaseBatch([ref.eventId], owner.organizationId),
    },
  },
};

export const receiptResource = defineResource(resource);
