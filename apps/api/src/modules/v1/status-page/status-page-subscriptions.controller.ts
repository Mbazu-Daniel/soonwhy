import { Controller, Post, Delete, Body, Param } from "@nestjs/common";
import { StatusPageSubscriptionsRepository } from "./status-page-subscriptions.repository";
import { resolveStatusTarget } from "./resolve-status-target";
import { SubscribeToStatusPageDto, type SubscribeToStatusPageInput } from "./status-page-subscription.dto";

@Controller("public/status/:orgSlug/:projectSlug/subscriptions")
export class StatusPageSubscriptionsController {
  constructor(private readonly repository: StatusPageSubscriptionsRepository) {}

  @Post()
  async subscribe(
    @Param("orgSlug") orgSlug: string,
    @Param("projectSlug") projectSlug: string,
    @Body({ schema: SubscribeToStatusPageDto }) body: SubscribeToStatusPageInput,
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
