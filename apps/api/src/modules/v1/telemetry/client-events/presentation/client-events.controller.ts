import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";
import { ApiKeyAuthenticator } from "@soonwhy/shared";
import { Throttle } from "@nestjs/throttler";
import { requireApiKey } from "../../../../../common/auth/require-api-key";
import { ClientEventsService } from "../application/client-events.service";
import { ClientEventsBatchDto, type ClientEventsBatchInput } from "../domain/dto";
import { INGEST_THROTTLE } from "../../../../../common/throttling/throttling.constants";

@Controller("client-events")
export class ClientEventsController {
  constructor(
    private readonly clientEvents: ClientEventsService,
    private readonly apiKeys: ApiKeyAuthenticator,
  ) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(INGEST_THROTTLE)
  async ingest(
    @Body({ schema: ClientEventsBatchDto }) body: ClientEventsBatchInput,
    @Headers("authorization") auth?: string,
  ) {
    const key = await requireApiKey(this.apiKeys, auth);

    await this.clientEvents.ingestEvents(key.organizationId, key.projectId, body.events);
  }
}
