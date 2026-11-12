import {
  BadRequestException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from "@nestjs/common";

type AiErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_CREDENTIAL_UNREADABLE"
  | "AI_CREDENTIAL_ENCRYPTION_UNAVAILABLE"
  | "AI_CREDENTIAL_INVALID"
  | "AI_PROVIDER_UNSUPPORTED"
  | "AI_PROVIDER_BASE_URL_INVALID"
  | "AI_PROVIDER_ENDPOINT_UNKNOWN"
  | "AI_QUOTA_EXCEEDED";

interface AiErrorBody {
  code: AiErrorCode;
  title: string;
  detail: string;
  hint: string;
}

export class CredentialDecryptError extends Error {
  constructor() {
    super("Stored AI credential could not be decrypted");
    this.name = "CredentialDecryptError";
  }
}

function unavailable(body: AiErrorBody): ServiceUnavailableException {
  return new ServiceUnavailableException(body);
}

export function aiCredentialUnreadable(): ServiceUnavailableException {
  return unavailable({
    code: "AI_CREDENTIAL_UNREADABLE",
    title: "Stored AI credential could not be decrypted",
    detail:
      "The saved AI provider key could not be decrypted. The server encryption key may have changed.",
    hint: "Open AI settings and save the provider key again.",
  });
}

export function aiEncryptionUnavailable(): ServiceUnavailableException {
  return unavailable({
    code: "AI_CREDENTIAL_ENCRYPTION_UNAVAILABLE",
    title: "AI credential storage is unavailable",
    detail:
      "This server has no SOONWHY_PII_ENCRYPTION_KEY configured, so bring-your-own-key AI credentials cannot be stored or read.",
    hint: "Generate one with `openssl rand -hex 32` and set it on the API service.",
  });
}

export function aiNotConfigured(): ServiceUnavailableException {
  return unavailable({
    code: "AI_NOT_CONFIGURED",
    title: "AI provider not configured",
    detail:
      "No AI provider is available for this organization, so root cause analysis cannot run.",
    hint: "An owner or admin can add a provider key under AI settings.",
  });
}

export function aiEndpointUnknown(
  providerId: string,
): ServiceUnavailableException {
  return unavailable({
    code: "AI_PROVIDER_ENDPOINT_UNKNOWN",
    title: "AI provider endpoint is unknown",
    detail: `No endpoint is documented for the AI provider "${providerId}", so its key cannot be sent anywhere.`,
    hint: "Open AI settings and set the provider's base URL.",
  });
}

export function aiCredentialInvalid(detail: string): BadRequestException {
  return new BadRequestException({
    code: "AI_CREDENTIAL_INVALID",
    title: "AI credential is not valid",
    detail,
    hint: "Check the provider, model and key, then try again.",
  });
}

export function aiProviderUnsupported(providerId: string): BadRequestException {
  return new BadRequestException({
    code: "AI_PROVIDER_UNSUPPORTED",
    title: "AI provider is not supported",
    detail: `"${providerId}" is not a provider this server can send requests to.`,
    hint: "Pick a provider from the list in AI settings.",
  });
}

export function aiBaseUrlInvalid(detail: string): BadRequestException {
  return new BadRequestException({
    code: "AI_PROVIDER_BASE_URL_INVALID",
    title: "AI provider base URL is not valid",
    detail,
    hint: "Leave the base URL empty to use the provider's default endpoint.",
  });
}

/**
 * A quota rejection is a billing fact about the organisation, not a provider
 * failure, so it gets its own code rather than reaching the client as a 500.
 */
export function aiQuotaExceeded(metric: string): HttpException {
  return new HttpException(
    {
      code: "AI_QUOTA_EXCEEDED",
      title: "AI usage quota exceeded",
      detail: `This month's ${metric} allowance is used up, so AI analysis is paused.`,
      hint: "An owner or admin can buy more AI usage under billing settings, or add the organisation's own provider key under AI settings.",
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
