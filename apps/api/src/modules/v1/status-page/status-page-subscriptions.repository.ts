import { Injectable } from "@nestjs/common";
import { db } from "../../../common/db";
import { statusPageSubscriptions } from "../../../common/db/schema";
import { eq, and } from "drizzle-orm";

@Injectable()
export class StatusPageSubscriptionsRepository {
  async createSubscription(orgId: string, projectId: string, data: { email: string; slackWebhookUrl?: string }) {
    const [subscription] = await db
      .insert(statusPageSubscriptions)
      .values({
        orgId,
        projectId,
        email: data.email,
        slackWebhookUrl: data.slackWebhookUrl,
      })
      .returning();
    return subscription;
  }

  async getSubscriptions(orgId: string, projectId: string) {
    return db
      .select()
      .from(statusPageSubscriptions)
      .where(
        and(
          eq(statusPageSubscriptions.orgId, orgId),
          eq(statusPageSubscriptions.projectId, projectId),
          eq(statusPageSubscriptions.enabled, true),
        ),
      );
  }

  async unsubscribe(subscriptionId: string) {
    await db
      .update(statusPageSubscriptions)
      .set({ enabled: false, unsubscribedAt: new Date() })
      .where(eq(statusPageSubscriptions.id, subscriptionId));
  }

  async getByEmail(orgId: string, projectId: string, email: string) {
    const [subscription] = await db
      .select()
      .from(statusPageSubscriptions)
      .where(
        and(
          eq(statusPageSubscriptions.orgId, orgId),
          eq(statusPageSubscriptions.projectId, projectId),
          eq(statusPageSubscriptions.email, email),
        ),
      )
      .limit(1);
    return subscription;
  }
}
