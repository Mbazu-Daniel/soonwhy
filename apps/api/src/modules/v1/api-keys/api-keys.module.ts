import { Module } from "@nestjs/common";
import { ApiKeyAuthenticator, DB, type Db } from "@soonwhy/shared";
import { db } from "../../../common/db";
import { ApiKeysController } from "./api-keys.controller";
import { ApiKeysService } from "./api-keys.service";
import { ApiKeysRepository } from "./api-keys.repository";

@Module({
  controllers: [ApiKeysController],
  providers: [
    ApiKeysService,
    ApiKeysRepository,
    { provide: DB, useFactory: () => db as unknown as Db },
    ApiKeyAuthenticator,
  ],
  exports: [ApiKeysService, ApiKeyAuthenticator],
})
export class ApiKeysModule {}
