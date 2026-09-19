import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ServicesRepository } from './services.repository';
import { CreateServiceInput } from './dto';

@Injectable()
export class ServicesService {
  constructor(private readonly servicesRepository: ServicesRepository) {}

  async getServiceById(id: string, orgId: string) {
    const svc = await this.servicesRepository.getServiceById(id, orgId);
    if (!svc) throw new NotFoundException('Service not found');
    return svc;
  }

  async getServicesForProject(projectId: string, orgId: string) {
    return this.servicesRepository.getServicesByProjectId(projectId, orgId);
  }

  async createService(projectId: string, orgId: string, input: CreateServiceInput) {
    const existing = await this.servicesRepository.getServiceByProjectAndSlug(
      projectId,
      orgId,
      input.slug,
    );
    if (existing) throw new ConflictException('Service slug already exists in this project');
    return this.servicesRepository.createService({ projectId, ...input });
  }

  async deleteService(id: string, orgId: string) {
    await this.getServiceById(id, orgId);
    return this.servicesRepository.deleteService(id, orgId);
  }
}
