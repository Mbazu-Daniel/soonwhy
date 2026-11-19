import { Module } from "@nestjs/common";
import { ApiKeysRepository } from "../api-keys/infrastructure/api-keys.repository";
import { ServiceAccountsController } from "./presentation/service-accounts.controller";
import { ServiceAccountsRepository } from "./infrastructure/service-accounts.repository";
import { ServiceAccountsService } from "./application/service-accounts.service";

@Module({
  controllers: [ServiceAccountsController],
  providers: [ServiceAccountsService, ServiceAccountsRepository, ApiKeysRepository],
})
export class ServiceAccountsModule {}
