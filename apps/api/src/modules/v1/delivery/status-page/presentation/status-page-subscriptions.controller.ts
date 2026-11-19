import { Controller, Post, Delete, Body, Param } from "@nestjs/common";
import { StatusPageSubscriptionsService } from "../application/status-page-subscriptions.service";
import { resolveStatusTarget } from "../domain/resolve-status-target";
import { SubscribeToStatusPageDto, type SubscribeToStatusPageInput } from "../domain/status-page-subscription.dto";

@Controller("public/status/:orgSlug/:projectSlug/subscriptions")
export class StatusPageSubscriptionsController {
  constructor(private readonly subscriptions: StatusPageSubscriptionsService) {}

  @Post()
  async subscribe(
    @Param("orgSlug") orgSlug: string,
    @Param("projectSlug") projectSlug: string,
    @Body({ schema: SubscribeToStatusPageDto }) body: SubscribeToStatusPageInput,
  ) {
    const { orgId, projectId } = await resolveStatusTarget(orgSlug, projectSlug);
    return this.subscriptions.subscribe(orgId, projectId, body);
  }

  @Delete(":subscriptionId")
  async unsubscribe(
    @Param("orgSlug") orgSlug: string,
    @Param("projectSlug") projectSlug: string,
    @Param("subscriptionId") subscriptionId: string,
  ) {
    const { orgId, projectId } = await resolveStatusTarget(orgSlug, projectSlug);
    return this.subscriptions.unsubscribe(orgId, projectId, subscriptionId);
  }
}
