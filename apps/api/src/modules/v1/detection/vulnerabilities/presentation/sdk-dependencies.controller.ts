import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiKeyAuthenticator } from "@soonwhy/shared";
import { requireApiKey } from "../../../../../common/auth/require-api-key";
import { INGEST_THROTTLE } from "../../../../../common/throttling/throttling.constants";
import { VulnerabilityScanService } from "../application/vulnerability-scan.service";
import { DependencySnapshotBodySchema } from "../domain/vulnerability.schema";
import type { DependencySnapshotBody } from "../domain/vulnerability.types";

@Controller("sdk/dependencies")
export class SdkDependenciesController {
  constructor(
    private readonly scans: VulnerabilityScanService,
    private readonly apiKeys: ApiKeyAuthenticator,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle(INGEST_THROTTLE)
  async submit(
    @Body({ schema: DependencySnapshotBodySchema }) body: DependencySnapshotBody,
    @Headers("authorization") authorization?: string,
  ) {
    const key = await requireApiKey(this.apiKeys, authorization);
    return this.scans.submit(key.organizationId, key.projectId, body);
  }
}
