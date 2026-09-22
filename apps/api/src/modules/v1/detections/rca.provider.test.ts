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

describe('OpenAiCompatibleRcaProvider', () => {
  it('sends structured JSON instructions and parses the response', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
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
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const provider = new OpenAiCompatibleRcaProvider({
      apiKey: 'test-key',
      model: 'test-model',
      baseUrl: 'https://example.test/v1',
    });

    const result = await provider.analyze(evidence);

    expect(result.confidence).toBe('medium');
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://example.test/v1/chat/completions');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      authorization: 'Bearer test-key',
      'content-type': 'application/json',
    });

    const body = JSON.parse(String(init?.body)) as {
      model: string;
      temperature: number;
      response_format: { type: string };
    };

    expect(body.model).toBe('test-model');
    expect(body.temperature).toBe(0);
    expect(body.response_format.type).toBe('json_object');

    fetchMock.mockRestore();
  });

  it('rejects invalid provider JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{invalid' } }],
        }),
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
    });

    await expect(provider.analyze(evidence)).rejects.toThrow('502');
    vi.restoreAllMocks();
  });
});
