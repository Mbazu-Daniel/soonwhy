import { Module } from "@nestjs/common";
import {
  OrganizationController,
  OrganizationsController,
} from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";
import { OrganizationsRepository } from "./organizations.repository";
import { ProjectsModule } from "../projects/projects.module";
import { ProjectsRepository } from "../projects/projects.repository";

@Module({
  imports: [ProjectsModule],
  controllers: [OrganizationsController, OrganizationController],
  providers: [OrganizationsService, OrganizationsRepository],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
