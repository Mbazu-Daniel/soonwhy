import { MastraRcaProvider } from "../../../detection/detections/infrastructure/rca.provider";
import type { RcaCredentialInfo } from "../../../detection/detections/domain/rca.types";
import type { LlmCredentialSource } from "../../../../../common/db/schema";

export interface ResolvedLlmModel {
  readonly source: LlmCredentialSource;
  readonly providerId: string;
  readonly model: string;
  readonly baseUrl: string | null;
  readonly apiKey: string;
  readonly credentialId: string | null;
}

export interface ResolvedLlmHandle {
  readonly provider: MastraRcaProvider;
  readonly credential: RcaCredentialInfo;
  readonly promptVersion: string;
}

export interface LlmCredentialSummary {
  readonly source: LlmCredentialSource | "none";
  readonly provider: string | null;
  readonly model: string | null;
}
