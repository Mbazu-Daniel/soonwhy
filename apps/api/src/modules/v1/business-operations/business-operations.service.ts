import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessOperationsRepository } from './business-operations.repository';
import type { CreateBusinessOperationInput } from './dto/create-business-operation.dto';

@Injectable()
export class BusinessOperationsService {
  constructor(private readonly repository: BusinessOperationsRepository) {}

  async list(projectId: string, orgId: string) {
    return (await this.repository.list(projectId, orgId)).map(({ operation }) => operation);
  }

  async getById(id: string, projectId: string, orgId: string) {
    const operation = await this.repository.getById(id, projectId, orgId);
    if (!operation) throw new NotFoundException('Business operation not found');
    return operation;
  }

  async create(projectId: string, orgId: string, input: CreateBusinessOperationInput) {
    if (!(await this.repository.validateContext(orgId, projectId, input.serviceId, input.environmentId))) {
      throw new NotFoundException('Service or environment not found');
    }

    if (await this.repository.findBySlug(projectId, orgId, input.slug)) {
      throw new ConflictException('Business operation slug already exists in this project');
    }

    return this.repository.create(orgId, projectId, input);
  }
}
