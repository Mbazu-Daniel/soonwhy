import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ServicesRepository } from './services.repository';
import { CreateServiceInput } from './dto';

@Injectable()
export class ServicesService {
  constructor(private readonly servicesRepository: ServicesRepository) {}

  async getServiceById(id: string) {
    const svc = await this.servicesRepository.getServiceById(id);
    if (!svc) throw new NotFoundException('Service not found');
    return svc;
  }

  async getServicesForProject(projectId: string) {
    return this.servicesRepository.getServicesByProjectId(projectId);
  }

  async createService(projectId: string, input: CreateServiceInput) {
    const existing = await this.servicesRepository.getServiceByProjectAndSlug(
      projectId,
      input.slug,
    );
    if (existing) throw new ConflictException('Service slug already exists in this project');
    return this.servicesRepository.createService({ projectId, ...input });
  }

  async deleteService(id: string) {
    const svc = await this.servicesRepository.getServiceById(id);
    if (!svc) throw new NotFoundException('Service not found');
    return this.servicesRepository.deleteService(id);
  }
}
