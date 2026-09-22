import { RcaAnalysisSchema } from './rca.validation';
import { buildRcaPrompt } from './rca.prompt';
import type { RcaEvidence, RcaProvider } from './rca.types';

export interface OpenAiCompatibleRcaProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxPromptCharacters?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

export class OpenAiCompatibleRcaProvider implements RcaProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxPromptCharacters: number;

  constructor(private readonly config: OpenAiCompatibleRcaProviderConfig) {
    this.baseUrl = (config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.maxPromptCharacters = config.maxPromptCharacters ?? 30_000;

    if (!config.apiKey.trim()) {
      throw new Error('RCA provider API key is required');
    }

    if (!config.model.trim()) {
      throw new Error('RCA provider model is required');
    }
  }

  async analyze(input: RcaEvidence) {
    const prompt = buildRcaPrompt(input);

    if (prompt.length > this.maxPromptCharacters) {
      throw new Error('RCA evidence exceeds the provider prompt size limit');
    }

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
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        throw new Error(`RCA provider request failed (${response.status}): ${detail}`);
      }

      const payload = (await response.json()) as ChatCompletionResponse;
      const content = payload.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('RCA provider returned an empty response');
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(content);
      } catch {
        throw new Error('RCA provider returned invalid JSON');
      }

      return RcaAnalysisSchema.parse(parsedJson);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('RCA provider request timed out');
      }

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('RCA provider request failed');
    } finally {
      clearTimeout(timeout);
    }
  }
}
