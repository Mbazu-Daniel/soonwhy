import { Module } from "@nestjs/common";
import { SyntheticProbesController } from "./presentation/synthetic-probes.controller";
import { SyntheticProbesService } from "./application/synthetic-probes.service";
import { SyntheticProbesRepository } from "./infrastructure/synthetic-probes.repository";

@Module({
  controllers: [SyntheticProbesController],
  providers: [SyntheticProbesService, SyntheticProbesRepository],
  exports: [SyntheticProbesService, SyntheticProbesRepository],
})
export class SyntheticProbesModule {}
