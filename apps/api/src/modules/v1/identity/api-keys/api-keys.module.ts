import { Module } from "@nestjs/common";
import { ApiKeyAuthenticator, DB, type Db } from "@soonwhy/shared";
import { db } from "../../../../common/db";
import { ApiKeysController } from "./presentation/api-keys.controller";
import { ApiKeysService } from "./application/api-keys.service";
import { ApiKeysRepository } from "./infrastructure/api-keys.repository";

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
