import { Module } from "@nestjs/common";
import { SyntheticProbesController } from "./synthetic-probes.controller";
import { SyntheticProbesService } from "./synthetic-probes.service";
import { SyntheticProbesRepository } from "./synthetic-probes.repository";

@Module({
  controllers: [SyntheticProbesController],
  providers: [SyntheticProbesService, SyntheticProbesRepository],
  exports: [SyntheticProbesService],
})
export class SyntheticProbesModule {}
