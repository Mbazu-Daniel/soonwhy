import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "../../../../../common/db";
import {
  deployments,
  environments,
  services,
  webhookDeliveries,
} from "../../../../../common/db/schema";
import { eq } from "drizzle-orm";
import { WEBHOOK_SECRET_CONTEXT } from "../domain/github.constants";

function normalizeRepoUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
}

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  secretForProject(projectId: string): string {
    return createHmac("sha256", this.verifyWebhookSecret())
      .update(`${WEBHOOK_SECRET_CONTEXT}:${projectId}`)
      .digest("hex");
  }

  verifyWebhookSecret(): string {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      throw new UnauthorizedException(
        "GITHUB_WEBHOOK_SECRET is not configured",
      );
    }
    return secret;
  }

  verifySignature(
    rawBody: Buffer | string,
    signature: string | undefined,
    secret: string | undefined,
  ): boolean {
    if (!secret) return false;
    if (!signature) return false;
    const hmac = createHmac("sha256", secret).update(rawBody).digest("hex");
    const expected = `sha256=${hmac}`;
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  async handlePushEvent(
    projectId: string,
    rawBody: Buffer | string,
    eventName: string | undefined,
    deliveryId?: string,
  ) {
    if (eventName && eventName !== "push") {
      return { handled: false, reason: `ignored event: ${eventName}` };
    }

    const payload = JSON.parse(
      typeof rawBody === "string" ? rawBody : rawBody.toString("utf8"),
    );
    const repoUrl =
      payload?.repository?.html_url ?? payload?.repository?.clone_url;
    const commitSha = payload?.head_commit?.id ?? payload?.after;
    const commitMessage = payload?.head_commit?.message;

    if (!repoUrl || !commitSha) {
      return { handled: false, reason: "missing repository or commit" };
    }

    const normalized = normalizeRepoUrl(repoUrl);
    const projectServices = await db
      .select()
      .from(services)
      .where(eq(services.projectId, projectId));
    const matched = projectServices.filter(
      (service) =>
        service.repositoryUrl &&
        normalizeRepoUrl(service.repositoryUrl) === normalized,
    );

    if (matched.length === 0) {
      return { handled: false, reason: "no matching service" };
    }

    const created: Array<typeof deployments.$inferSelect> = [];
    let duplicate = false;
    await db.transaction(async (tx) => {
      if (deliveryId) {
        const claim = await tx
          .insert(webhookDeliveries)
          .values({ source: "github", deliveryId })
          .onConflictDoNothing()
          .returning({ id: webhookDeliveries.id });
        if (claim.length === 0) {
          duplicate = true;
          return;
        }
      }

      for (const service of matched) {
        let [environment] = await tx
          .select()
          .from(environments)
          .where(eq(environments.projectId, service.projectId))
          .limit(1);

        if (!environment) {
          [environment] = await tx
            .insert(environments)
            .values({
              projectId: service.projectId,
              name: "Production",
              slug: "production",
              kind: "production",
            })
            .returning();
        }

        const [deployment] = await tx
          .insert(deployments)
          .values({
            serviceId: service.id,
            environmentId: environment!.id,
            version: String(commitSha).slice(0, 7),
            commitSha: String(commitSha),
            status: "active",
            deployedAt: new Date(),
          })
          .returning();

        created.push(deployment!);
        this.logger.log(
          `Created deployment ${deployment!.id} for service ${service.id} from GitHub push`,
        );
      }
    });

    if (duplicate) {
      return { handled: false, reason: "duplicate delivery" };
    }

    return { handled: true, deployments: created, commitMessage };
  }
}
