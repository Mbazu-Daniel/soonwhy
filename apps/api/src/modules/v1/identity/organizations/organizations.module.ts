import { Module } from "@nestjs/common";
import {
  OrganizationController,
  OrganizationsController,
} from "./presentation/organizations.controller";
import { OrganizationsService } from "./application/organizations.service";
import { OrganizationsRepository } from "./infrastructure/organizations.repository";
import { ProjectsModule } from "../projects/projects.module";

@Module({
  imports: [ProjectsModule],
  controllers: [OrganizationsController, OrganizationController],
  providers: [OrganizationsService, OrganizationsRepository],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
