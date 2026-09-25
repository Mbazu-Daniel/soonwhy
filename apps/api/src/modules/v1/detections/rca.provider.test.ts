import { describe, expect, it, vi } from 'vitest';
import type { RcaEvidence } from './rca.types';
import { OpenAiCompatibleRcaProvider } from './rca.provider';

const evidence: RcaEvidence = {
  projectId: 'project_123',
  serviceName: 'checkout-api',
  severity: 'critical',
  window: {
    start: new Date('2026-09-22T00:00:00.000Z'),
    end: new Date('2026-09-22T00:15:00.000Z'),
  },
  primaryFinding: {
    id: 'finding_latency:0',
    sourceFindingId: 'finding_latency',
    type: 'latency',
    severity: 'critical',
    label: 'primary-latency',
    value: 1600,
  },
  supportingFindings: [],
  traces: [],
  recommendations: [],
};

function response() {
  return new Response(
    JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            summary: 'Checkout latency increased.',
            rootCause: 'The available evidence indicates latency degradation.',
            contributingFactors: [],
            investigationSteps: ['Inspect the dominant operation.'],
            suggestedChanges: ['Review the dominant operation.'],
            evidenceRefs: ['finding_latency:0'],
            confidence: 'medium',
            limitations: ['Only deterministic evidence was supplied.'],
          }),
        },
      }],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 40,
        total_tokens: 140,
      },
    }),
    { status: 200 },
  );
}

describe('OpenAiCompatibleRcaProvider', () => {
  it('uses the configured prompt version and returns usage metadata', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response());

    const provider = new OpenAiCompatibleRcaProvider({
      apiKey: 'test-key',
      model: 'test-model',
      baseUrl: 'https://example.test/v1',
      promptVersion: 'v1',
      inputCostPerMillionTokensUsd: 1,
      outputCostPerMillionTokensUsd: 2,
    });

    const result = await provider.analyze(evidence);

    expect(result.analysis.confidence).toBe('medium');
    expect(result.promptVersion).toBe('v1');
    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(40);
    expect(result.usage.totalTokens).toBe(140);
    expect(result.usage.estimatedCostUsd).toBeCloseTo(0.00018);

    const [, init] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body)) as {
      messages: Array<{ content: string }>;
    };
    expect(body.messages[0]?.content).toContain('Prompt version: v1');

    fetchMock.mockRestore();
  });

  it('rejects invalid provider JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: '{invalid' } }] }),
        { status: 200 },
      ),
    );

    const provider = new OpenAiCompatibleRcaProvider({
      apiKey: 'test-key',
      model: 'test-model',
      baseUrl: 'https://example.test/v1',
    });

    await expect(provider.analyze(evidence)).rejects.toThrow('invalid JSON');
    vi.restoreAllMocks();
  });

  it('rejects provider failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('upstream failure', { status: 502 }),
    );

    const provider = new OpenAiCompatibleRcaProvider({
      apiKey: 'test-key',
      model: 'test-model',
      baseUrl: 'https://example.test/v1',
      maxRetries: 0,
    });

    await expect(provider.analyze(evidence)).rejects.toThrow('502');
    vi.restoreAllMocks();
  });
});
