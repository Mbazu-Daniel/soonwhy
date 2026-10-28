import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module";
import { IssueLifecycleModule } from "../intelligence/issue-lifecycle.module";
import { DetectionController } from "./detection.controller";
import { DetectionService } from "./detection.service";
import { RcaModule } from "./rca.module";
import { RcaController } from "./rca.controller";
import { RcaApiService } from "./rca.api";
import { RcaAnalysisRepository } from "./rca.repository";
import { RcaPersistenceService } from "./rca.persistence";
import { TelemetryModule } from "../../../common/telemetry";

@Module({
  imports: [ProjectsModule, RcaModule, IssueLifecycleModule, TelemetryModule],
  controllers: [DetectionController, RcaController],
  providers: [
    DetectionService,
    RcaApiService,
    RcaAnalysisRepository,
    RcaPersistenceService,
  ],
})
export class DetectionModule {}
