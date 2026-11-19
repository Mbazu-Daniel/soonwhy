import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../../src/common/db";
import { findings, rcaInvocations, usageEvents } from "../../src/common/db/schema";
import { AiRepository } from "../../src/modules/v1/investigation/ai/infrastructure/ai.repository";
import { AiService } from "../../src/modules/v1/investigation/ai/application/ai.service";
import { CHAT_USAGE_SOURCE } from "../../src/modules/v1/investigation/ai/investigation-chat/investigation-chat.constants";
import { closeDatabase, databaseTestsEnabled, resetDatabase } from "../support/test-database";
import { createOrganization, createProject } from "../support/fixtures";

const FROM = new Date("2026-11-01T00:00:00Z");
const TO = new Date("2026-12-01T00:00:00Z");
const INSIDE = new Date("2026-11-10T00:00:00Z");

async function addRun(orgId: string, projectId: string, run: { tokens: number; cost: number; at?: Date }) {
  const [finding] = await db
    .insert(findings)
    .values({
      orgId,
      projectId,
      serviceName: "api",
      type: "latency",
      severity: "high",
      title: "slow",
      description: "slow",
      observedValue: 1,
      threshold: 1,
      unit: "ms",
      windowStart: FROM,
      windowEnd: TO,
      evidence: [],
    })
    .returning();
  await db.insert(rcaInvocations).values({
    orgId,
    projectId,
    findingId: finding!.id,
    status: "succeeded",
    provider: "groq",
    model: "m",
    promptVersion: "v1",
    requestDurationMs: 10,
    retries: 0,
    totalTokens: run.tokens,
    estimatedCostUsd: run.cost,
    createdAt: run.at ?? INSIDE,
  });
}

async function addChat(
  orgId: string,
  projectId: string | null,
  quantity: number,
  source = CHAT_USAGE_SOURCE,
  at = INSIDE,
  metadata: Record<string, string | number | boolean | null> | null = null,
) {
  await db.insert(usageEvents).values({ orgId, projectId, metric: "ai_tokens_byok", quantity, source, occurredAt: at, metadata });
}

describe.skipIf(!databaseTestsEnabled)("AiRepository.getProjectSpend", () => {
  const repository = new AiRepository();

  beforeEach(resetDatabase);
  afterAll(closeDatabase);

  it("adds up runs, tokens and cost for each project", async () => {
    const org = await createOrganization();
    const web = await createProject(org.id, "web");
    const worker = await createProject(org.id, "worker");
    await addRun(org.id, web.id, { tokens: 1_000, cost: 0.25 });
    await addRun(org.id, web.id, { tokens: 2_000, cost: 0.5 });
    await addRun(org.id, worker.id, { tokens: 500, cost: 0.1 });
    await addChat(org.id, web.id, 700);

    const spend = await repository.getProjectSpend(org.id, FROM, TO);

    expect(spend).toEqual([
      { projectId: web.id, name: "web", slug: "web", runs: 2, rcaTokens: 3_000, chatTokens: 700, chatCostUsd: 0, costUsd: 0.75 },
      { projectId: worker.id, name: "worker", slug: "worker", runs: 1, rcaTokens: 500, chatTokens: 0, chatCostUsd: 0, costUsd: 0.1 },
    ]);
  });

  it("adds the estimated cost of chat turns to the project's cost", async () => {
    const org = await createOrganization();
    const web = await createProject(org.id, "web");
    await addRun(org.id, web.id, { tokens: 1_000, cost: 0.5 });
    await addChat(org.id, web.id, 400, CHAT_USAGE_SOURCE, INSIDE, { credentialSource: "byok", costUsd: 0.125 });
    await addChat(org.id, web.id, 600, CHAT_USAGE_SOURCE, INSIDE, { credentialSource: "byok", costUsd: 0.25 });
    await addChat(org.id, web.id, 100, CHAT_USAGE_SOURCE, INSIDE, { credentialSource: "byok", costUsd: null });
    await addChat(org.id, web.id, 100);

    const [row] = await repository.getProjectSpend(org.id, FROM, TO);

    expect(row).toMatchObject({ chatTokens: 1_200, chatCostUsd: 0.375, costUsd: 0.875 });
  });

  it("totals chat cost by who paid for it", async () => {
    const org = await createOrganization();
    const other = await createOrganization();
    const web = await createProject(org.id, "web");
    const theirs = await createProject(other.id, "theirs");
    await addChat(org.id, web.id, 100, CHAT_USAGE_SOURCE, INSIDE, { credentialSource: "byok", costUsd: 0.5 });
    await addChat(org.id, web.id, 100, CHAT_USAGE_SOURCE, INSIDE, { credentialSource: "platform", costUsd: 0.25 });
    await addChat(org.id, web.id, 100, CHAT_USAGE_SOURCE, new Date("2026-10-01T00:00:00Z"), { credentialSource: "byok", costUsd: 9 });
    await addChat(other.id, theirs.id, 100, CHAT_USAGE_SOURCE, INSIDE, { credentialSource: "byok", costUsd: 7 });

    const totals = await repository.getChatCostTotals(org.id, FROM, TO);

    expect(Object.fromEntries(totals.map((row) => [row.credentialSource, row.costUsd]))).toEqual({ byok: 0.5, platform: 0.25 });
  });

  it("lists a project that only used chat", async () => {
    const org = await createOrganization();
    const chatty = await createProject(org.id, "chatty");
    await addChat(org.id, chatty.id, 1_200);

    const spend = await repository.getProjectSpend(org.id, FROM, TO);

    expect(spend).toEqual([
      { projectId: chatty.id, name: "chatty", slug: "chatty", runs: 0, rcaTokens: 0, chatTokens: 1_200, chatCostUsd: 0, costUsd: 0 },
    ]);
  });

  it("puts the most expensive project first", async () => {
    const org = await createOrganization();
    const cheap = await createProject(org.id, "cheap");
    const pricey = await createProject(org.id, "pricey");
    await addRun(org.id, cheap.id, { tokens: 10, cost: 0.01 });
    await addRun(org.id, pricey.id, { tokens: 10, cost: 5 });

    const spend = await repository.getProjectSpend(org.id, FROM, TO);

    expect(spend.map((row) => row.slug)).toEqual(["pricey", "cheap"]);
  });

  it("never includes another organization's projects", async () => {
    const org = await createOrganization();
    const other = await createOrganization();
    const mine = await createProject(org.id, "mine");
    const theirs = await createProject(other.id, "theirs");
    await addRun(org.id, mine.id, { tokens: 100, cost: 0.1 });
    await addRun(other.id, theirs.id, { tokens: 9_999, cost: 99 });
    await addChat(other.id, theirs.id, 9_999);

    const spend = await repository.getProjectSpend(org.id, FROM, TO);

    expect(spend.map((row) => row.slug)).toEqual(["mine"]);
  });

  it("ignores usage outside the period and usage that is not chat", async () => {
    const org = await createOrganization();
    const project = await createProject(org.id, "web");
    await addRun(org.id, project.id, { tokens: 1_000, cost: 1, at: new Date("2026-10-31T23:59:59Z") });
    await addRun(org.id, project.id, { tokens: 1_000, cost: 1, at: TO });
    await addChat(org.id, project.id, 500, CHAT_USAGE_SOURCE, new Date("2026-10-01T00:00:00Z"));
    await addChat(org.id, project.id, 500, "rca");
    await addChat(org.id, null, 500);

    await expect(repository.getProjectSpend(org.id, FROM, TO)).resolves.toEqual([]);
  });

  it("returns nothing for an organization with no AI use", async () => {
    const org = await createOrganization();
    await createProject(org.id, "quiet");

    await expect(repository.getProjectSpend(org.id, FROM, TO)).resolves.toEqual([]);
  });
});

describe.skipIf(!databaseTestsEnabled)("AiService.usage over the real database", () => {
  const billing = { getUsage: async () => [], getLimit: async () => null };
  const service = new AiService(new AiRepository(), {} as never, {} as never, {} as never, billing as never);

  beforeEach(resetDatabase);
  afterAll(closeDatabase);

  it("sends the fields the dashboard reads, in the shape it reads them", async () => {
    const org = await createOrganization();
    const web = await createProject(org.id, "web");
    await addRun(org.id, web.id, { tokens: 2_000, cost: 0.5, at: new Date("2026-11-05T00:00:00Z") });
    await addChat(org.id, web.id, 300, CHAT_USAGE_SOURCE, new Date("2026-11-06T00:00:00Z"));

    const wire = JSON.parse(JSON.stringify(await service.usage(org.id, "month", new Date("2026-11-18T00:00:00Z"))));

    expect(wire.period.name).toBe("month");
    expect(wire.projects).toEqual([
      { projectId: web.id, name: "web", slug: "web", runs: 1, rcaTokens: 2_000, chatTokens: 300, chatCostUsd: 0, costUsd: 0.5 },
    ]);
    expect(Object.keys(wire.projects[0]).sort()).toEqual(
      ["chatCostUsd", "chatTokens", "costUsd", "name", "projectId", "rcaTokens", "runs", "slug"],
    );
  });

  it("moves a run into last month's numbers and out of this month's", async () => {
    const org = await createOrganization();
    const web = await createProject(org.id, "web");
    await addRun(org.id, web.id, { tokens: 1_000, cost: 1, at: new Date("2026-10-15T00:00:00Z") });
    const now = new Date("2026-11-18T00:00:00Z");

    const thisMonth = await service.usage(org.id, "month", now);
    const lastMonth = await service.usage(org.id, "last_month", now);

    expect(thisMonth.projects).toEqual([]);
    expect(lastMonth.projects.map((row) => row.slug)).toEqual(["web"]);
  });
});
