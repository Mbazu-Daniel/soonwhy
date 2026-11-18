import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class PostmortemService {
  private readonly logger = new Logger(PostmortemService.name);

  async createPostmortem(
    orgId: string,
    projectId: string,
    incidentId: string,
    input: {
      title: string;
      templateId?: string;
      authorId: string;
      authorName: string;
      narrative: string;
      rootCause: string;
      contributingFactors: string[];
      actionItems: {
        description: string;
        ownerId: string;
        ownerName: string;
        dueDate: Date;
        completed: boolean;
      }[];
    },
  ): Promise<{ postmortemId: string; actionItemsCreated: number }> {
    this.logger.log(
      `Created postmortem (stub) for incident=${incidentId}, ${input.actionItems?.length ?? 0} action items`,
    );
    return { postmortemId: "stub", actionItemsCreated: input.actionItems?.length ?? 0 };
  }

  async getPostmortem(
    _orgId: string,
    _projectId: string,
    _incidentId: string,
  ): Promise<Record<string, unknown> | undefined> {
    return undefined;
  }

  async updatePostmortem(
    orgId: string,
    projectId: string,
    postmortemId: string,
    input: {
      status: "draft" | "published" | "archived";
      completedActionItems: string[];
    },
  ): Promise<boolean> {
    this.logger.log(`Updated postmortem (stub) ${postmortemId} -> ${input.status}`);
    return true;
  }

  async getActionItems(
    _orgId: string,
    _projectId: string,
    _postmortemId: string,
  ): Promise<Record<string, unknown>[]> {
    return [];
  }

  async completeActionItem(
    orgId: string,
    projectId: string,
    actionItemId: string,
  ): Promise<boolean> {
    this.logger.log(`Completed action item (stub) ${actionItemId}`);
    return true;
  }
}
