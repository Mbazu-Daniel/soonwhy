import { RcaAnalysisSchema } from './rca.validation';
import { buildRcaPrompt } from './rca.prompt';
import type { RcaEvidence, RcaProvider, RcaProviderResult } from './rca.types';

export interface OpenAiCompatibleRcaProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxPromptCharacters?: number;
  maxRetries?: number;
  inputCostPerMillionTokensUsd?: number;
  outputCostPerMillionTokensUsd?: number;
}

interface OpenAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: OpenAiUsage;
}

class RcaProviderRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'RcaProviderRequestError';
  }
}

export class OpenAiCompatibleRcaProvider implements RcaProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxPromptCharacters: number;
  private readonly maxRetries: number;

  constructor(private readonly config: OpenAiCompatibleRcaProviderConfig) {
    this.baseUrl = (config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.maxPromptCharacters = config.maxPromptCharacters ?? 30_000;
    this.maxRetries = config.maxRetries ?? 1;

    if (this.maxRetries < 0) throw new Error('RCA provider max retries cannot be negative');
    if (!config.apiKey.trim()) throw new Error('RCA provider API key is required');
    if (!config.model.trim()) throw new Error('RCA provider model is required');
  }

  async analyze(input: RcaEvidence): Promise<RcaProviderResult> {
    const prompt = buildRcaPrompt(input);
    if (prompt.length > this.maxPromptCharacters) {
      throw new Error('RCA evidence exceeds the provider prompt size limit');
    }

    const startedAt = Date.now();
    let retries = 0;

    while (true) {
      try {
        const payload = await this.request(prompt);
        const content = payload.choices?.[0]?.message?.content;
        if (!content) throw new Error('RCA provider returned an empty response');

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(content);
        } catch {
          throw new Error('RCA provider returned invalid JSON');
        }

        const analysis = RcaAnalysisSchema.parse(parsedJson);
        const inputTokens = payload.usage?.prompt_tokens;
        const outputTokens = payload.usage?.completion_tokens;
        const totalTokens = payload.usage?.total_tokens ?? (
          inputTokens !== undefined && outputTokens !== undefined
            ? inputTokens + outputTokens
            : undefined
        );

        return {
          analysis,
          usage: {
            requestDurationMs: Date.now() - startedAt,
            inputTokens,
            outputTokens,
            totalTokens,
            estimatedCostUsd: this.estimateCost(inputTokens, outputTokens),
            retries,
          },
        };
      } catch (error) {
        if (retries >= this.maxRetries || !this.isRetryable(error)) throw error;
        retries += 1;
      }
    }
  }

  private async request(prompt: string): Promise<ChatCompletionResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: prompt }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        throw new RcaProviderRequestError(
          response.status,
          `RCA provider request failed (${response.status}): ${detail}`,
        );
      }

      return (await response.json()) as ChatCompletionResponse;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new RcaProviderRequestError(408, 'RCA provider request timed out');
      }
      if (error instanceof Error) throw error;
      throw new Error('RCA provider request failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private isRetryable(error: unknown): boolean {
    return error instanceof RcaProviderRequestError
      && (error.status === 408 || error.status === 429 || error.status >= 500);
  }

  private estimateCost(inputTokens?: number, outputTokens?: number): number | undefined {
    if (inputTokens === undefined || outputTokens === undefined) return undefined;
    const inputRate = this.config.inputCostPerMillionTokensUsd;
    const outputRate = this.config.outputCostPerMillionTokensUsd;
    if (inputRate === undefined || outputRate === undefined) return undefined;
    return (inputTokens / 1_000_000) * inputRate
      + (outputTokens / 1_000_000) * outputRate;
  }
}

export class DisabledRcaProvider implements RcaProvider {
  async analyze(): Promise<never> {
    throw new Error('RCA provider is not configured');
  }
}
