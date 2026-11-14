import { describe, expect, it } from 'vitest';
import { DEFAULT_INGEST_URL, FRAMEWORKS } from './integration-guides';

const OTLP_GUIDES = ['otel-collector', 'python', 'go', 'docker', 'kubernetes'];
const guide = (id: string) => FRAMEWORKS.find((item) => item.id === id)!;
const render = (id: string, key?: string, endpoint?: string) => (guide(id) as { code: (key?: string, endpoint?: string) => string }).code(key, endpoint);

describe('integration guides', () => {
  it('lists the sdk guides first, then the new integrations, with unique ids', () => {
    const ids = FRAMEWORKS.map((item) => item.id);
    expect(ids).toEqual(['node', 'bun', 'nestjs', 'nextjs', 'vite', 'otel-collector', 'python', 'go', 'docker', 'kubernetes', 'nginx']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sends otlp to the ingest endpoint that was passed in, never a path that would double /v1', () => {
    for (const id of OTLP_GUIDES) {
      const text = render(id, 'KEY', 'https://ingest.example.com');
      expect(text, id).toContain('https://ingest.example.com');
      expect(text, id).not.toContain('/v1/v1');
      expect(text, id).not.toContain('https://ingest.example.com/v1');
    }
  });

  it('falls back to the hosted endpoint', () => {
    expect(render('otel-collector')).toContain(DEFAULT_INGEST_URL);
  });

  it('puts the key into env based guides but keeps it out of yaml and the kubernetes secret', () => {
    expect(render('python', 'swk_secret123')).toContain('Bearer%20swk_secret123');
    expect(render('go', 'swk_secret123')).toContain('Bearer%20swk_secret123');
    expect(render('otel-collector', 'swk_secret123')).toContain('${env:SOONWHY_API_KEY}');
    expect(render('docker', 'swk_secret123')).toContain('${env:SOONWHY_API_KEY}');
    const kubernetes = render('kubernetes', 'swk_secret123');
    expect(kubernetes).not.toContain('swk_secret123');
    expect(kubernetes).toContain('secretKeyRef');
  });

  it('shows a placeholder, not undefined, when there is no key', () => {
    for (const id of ['python', 'go', 'otel-collector', 'docker']) {
      expect(render(id), id).toContain('YOUR_PROJECT_API_KEY');
      expect(render(id), id).not.toContain('undefined');
    }
  });

  it('points nginx at the local collector because the module only speaks grpc', () => {
    expect(render('nginx')).toContain('endpoint localhost:4317');
    expect(guide('nginx').note).toContain('gRPC');
  });
});
