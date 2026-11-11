import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiKeysService } from "../api-keys/api-keys.service";
import { ClientEventsService } from "./client-events.service";
import { ClientEventsBatchDto, type ClientEventsBatchInput } from "./dto";
import { INGEST_THROTTLE } from "../../../common/throttling/throttling.constants";

@Controller("client-events")
export class ClientEventsController {
  constructor(
    private readonly clientEvents: ClientEventsService,
    private readonly apiKeys: ApiKeysService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(INGEST_THROTTLE)
  async ingest(
    @Body({ schema: ClientEventsBatchDto }) body: ClientEventsBatchInput,
    @Headers("authorization") auth?: string,
  ) {
    if (!auth?.startsWith("Bearer ")) {
      throw new UnauthorizedException("API key required");
    }

    const key = await this.apiKeys.validateKey(auth.slice(7));
    if (!key) {
      throw new UnauthorizedException("Invalid API key");
    }

    await this.clientEvents.ingestEvents(key.orgId, key.projectId, body.events);
  }
}
