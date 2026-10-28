import { Injectable, Logger } from "@nestjs/common";

type PostmortemRecord = any;
type ActionItemRecord = any;

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
    orgId: string,
    projectId: string,
    incidentId: string,
  ): Promise<PostmortemRecord | undefined> {
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
    orgId: string,
    projectId: string,
    postmortemId: string,
  ): Promise<ActionItemRecord[]> {
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
