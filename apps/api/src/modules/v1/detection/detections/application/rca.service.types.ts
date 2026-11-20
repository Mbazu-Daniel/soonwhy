import type { RcaCredentialInfo } from "../domain/rca.types";
import type { MastraRcaProvider } from "../infrastructure/rca.provider";
import type { LlmCredentialSummary } from "../../../investigation/ai/application/llm-provider.resolver.types";

export interface RcaModelHandle {
  readonly provider: Pick<MastraRcaProvider, "analyze">;
  readonly credential: RcaCredentialInfo;
  readonly promptVersion: string;
}

export interface RcaModelResolver {
  resolveForRca(orgId: string, credentialId?: string): Promise<RcaModelHandle>;
  describe(orgId: string): Promise<LlmCredentialSummary>;
}
