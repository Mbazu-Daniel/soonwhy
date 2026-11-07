import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiKeysService } from "../api-keys/api-keys.service";
import { ClientEventsService } from "./client-events.service";
import { ClientEventsBatchDto } from "./dto";

@Controller("client-events")
export class ClientEventsController {
  constructor(
    private readonly clientEvents: ClientEventsService,
    private readonly apiKeys: ApiKeysService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async ingest(
    @Body() body: unknown,
    @Headers("authorization") auth?: string,
  ) {
    const input = ClientEventsBatchDto.parse(body);

    let projectId: string;
    let orgId: string;

    // Authenticate via API key (Bearer token) for client SDKs
    if (auth?.startsWith("Bearer ")) {
      const rawKey = auth.slice(7);
      const key = await this.apiKeys.validateKey(rawKey);
      if (!key) {
        throw new UnauthorizedException("Invalid API key");
      }
      projectId = key.projectId;
      // orgId is not stored on the API key; we accept it from the body
      // as a fallback, or derive from project lookup if needed
      orgId = (input as any).orgId ?? "";
    } else {
      projectId = (input as any).projectId ?? "";
      orgId = (input as any).orgId ?? "";
    }

    if (!projectId) {
      throw new Error("projectId is required");
    }

    await this.clientEvents.ingestEvents(orgId, projectId, input.events);
  }
}
