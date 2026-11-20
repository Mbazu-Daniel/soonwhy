import { Agent } from "@mastra/core/agent";
import { noopLogger } from "@mastra/core/logger";
import type { ResolvedLlmModel } from "../application/llm-provider.resolver.types";
import { CHAT_AGENT_ID, CHAT_INSTRUCTIONS } from "./investigation-chat.constants";
import type { buildInvestigationTools } from "./investigation-chat.tools";

export function createInvestigationAgent(model: ResolvedLlmModel, tools: ReturnType<typeof buildInvestigationTools>) {
  const agent = new Agent({
    id: CHAT_AGENT_ID,
    name: "Soonwhy investigator",
    instructions: CHAT_INSTRUCTIONS,
    tools,
    model: {
      providerId: model.providerId,
      modelId: model.model,
      ...(model.baseUrl ? { url: model.baseUrl } : {}),
      apiKey: model.apiKey,
    },
  });
  agent.__setLogger(noopLogger);
  return agent;
}
