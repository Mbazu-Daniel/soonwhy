import { ConflictException, Injectable } from '@nestjs/common';
import { TeamsRepository } from './teams.repository';
import type { CreateTeamInput } from './dto/create-team.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly repository: TeamsRepository) {}

  list(orgId: string) { return this.repository.list(orgId).then((rows) => rows.map(({ team }) => team)); }

  async create(orgId: string, input: CreateTeamInput) {
    if (await this.repository.findBySlug(orgId, input.slug)) {
      throw new ConflictException('Team slug already exists in this organization');
    }
    return this.repository.create(orgId, input);
  }
}
