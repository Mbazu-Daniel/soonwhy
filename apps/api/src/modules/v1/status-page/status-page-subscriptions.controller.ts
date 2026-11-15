import { Controller, Post, Delete, Body, Param } from "@nestjs/common";
import { StatusPageSubscriptionsRepository } from "./status-page-subscriptions.repository";
import { resolveStatusTarget } from "./resolve-status-target";

@Controller("public/status/:orgSlug/:projectSlug/subscriptions")
export class StatusPageSubscriptionsController {
  constructor(private readonly repository: StatusPageSubscriptionsRepository) {}

  @Post()
  async subscribe(
    @Param("orgSlug") orgSlug: string,
    @Param("projectSlug") projectSlug: string,
    @Body() body: { email: string; slackWebhookUrl?: string },
  ) {
    const { orgId, projectId } = await resolveStatusTarget(orgSlug, projectSlug);
    const existing = await this.repository.getByEmail(orgId, projectId, body.email);
    if (existing) {
      return { message: "Already subscribed" };
    }

    return this.repository.createSubscription(orgId, projectId, body);
  }

  @Delete(":subscriptionId")
  async unsubscribe(
    @Param("orgSlug") orgSlug: string,
    @Param("projectSlug") projectSlug: string,
    @Param("subscriptionId") subscriptionId: string,
  ) {
    const { orgId, projectId } = await resolveStatusTarget(orgSlug, projectSlug);
    await this.repository.unsubscribe(orgId, projectId, subscriptionId);
    return { message: "Unsubscribed successfully" };
  }
}
