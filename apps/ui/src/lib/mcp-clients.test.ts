import { describe, expect, it } from 'vitest';
import { MCP_PLACEHOLDER_KEY, mcpClientSnippets, mcpServerUrl } from './mcp-clients';

describe('mcp client snippets', () => {
  it('builds the server url without a doubled slash', () => {
    expect(mcpServerUrl('https://api.example.com/', '/api/v1')).toBe('https://api.example.com/api/v1/mcp');
    expect(mcpServerUrl('http://localhost:3001', '/api/v1')).toBe('http://localhost:3001/api/v1/mcp');
  });

  it('puts the url and key into every client', () => {
    const snippets = mcpClientSnippets('https://api.example.com/api/v1/mcp', 'swk_123');
    expect(snippets.map((snippet) => snippet.id)).toEqual(['claude-code', 'cursor', 'codex', 'other']);
    for (const snippet of snippets) expect(snippet.text).toContain('https://api.example.com/api/v1/mcp');
    expect(snippets[0]!.text).toContain('Authorization: Bearer swk_123');
    expect(JSON.parse(snippets[1]!.text).mcpServers.soonwhy.headers.Authorization).toBe('Bearer swk_123');
    expect(snippets[2]!.text).toContain('export SOONWHY_MCP_KEY=swk_123');
    expect(snippets[3]!.copyItems!.map((item) => item.value)).toContain('Authorization: Bearer swk_123');
  });

  it('shows a placeholder when there is no key yet', () => {
    for (const snippet of mcpClientSnippets('https://x/api/v1/mcp')) expect(snippet.text).toContain(MCP_PLACEHOLDER_KEY);
  });
});
