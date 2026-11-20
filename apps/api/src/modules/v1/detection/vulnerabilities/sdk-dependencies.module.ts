import { Module } from "@nestjs/common";
import { ApiKeysModule } from "../../identity/api-keys/api-keys.module";
import { SdkDependenciesController } from "./presentation/sdk-dependencies.controller";
import { VulnerabilitiesModule } from "./vulnerabilities.module";

@Module({
  imports: [ApiKeysModule, VulnerabilitiesModule],
  controllers: [SdkDependenciesController],
})
export class SdkDependenciesModule {}
