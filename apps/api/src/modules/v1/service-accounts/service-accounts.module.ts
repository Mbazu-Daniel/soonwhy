import { Module } from "@nestjs/common";
import { ApiKeysRepository } from "../api-keys/api-keys.repository";
import { ServiceAccountsController } from "./service-accounts.controller";
import { ServiceAccountsRepository } from "./service-accounts.repository";
import { ServiceAccountsService } from "./service-accounts.service";

@Module({
  controllers: [ServiceAccountsController],
  providers: [ServiceAccountsService, ServiceAccountsRepository, ApiKeysRepository],
})
export class ServiceAccountsModule {}
