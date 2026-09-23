import { BadRequestException, Injectable } from '@nestjs/common';
import { DeploymentsRepository } from './deployments.repository';
import type { CreateDeploymentInput } from './dto/create-deployment.dto';

@Injectable()
export class DeploymentsService {
  constructor(private readonly repository: DeploymentsRepository) {}

  async list(serviceId: string, orgId: string) {
    const rows = await this.repository.list(serviceId, orgId);
    return rows.map(({ deployment }) => deployment);
  }

  async create(orgId: string, input: CreateDeploymentInput) {
    const valid = await this.repository.belongsToTenant(input.serviceId, input.environmentId, orgId);
    if (!valid) throw new BadRequestException('Service and environment must belong to the same organization');
    return this.repository.create({ ...input, orgId });
  }
}
