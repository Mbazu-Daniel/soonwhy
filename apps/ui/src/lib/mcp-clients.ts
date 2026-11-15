export interface McpClientSnippet {
  id: 'claude-code' | 'cursor' | 'codex' | 'other';
  label: string;
  fileName?: string;
  text: string;
  note: string;
  copyItems?: Array<{ label: string; value: string }>;
}

export const MCP_PLACEHOLDER_KEY = 'YOUR_MCP_KEY';

export function mcpServerUrl(apiBase: string, apiPrefix: string): string {
  return `${apiBase.replace(/\/+$/, '')}${apiPrefix}/mcp`;
}

export function mcpClientSnippets(serverUrl: string, apiKey?: string): McpClientSnippet[] {
  const key = apiKey || MCP_PLACEHOLDER_KEY;
  return [
    {
      id: 'claude-code',
      label: 'Claude Code',
      text: `claude mcp add --transport http soonwhy ${serverUrl} \\\n  --header "Authorization: Bearer ${key}"`,
      note: 'Run it in your project. Add --scope user to use it in every project.',
    },
    {
      id: 'cursor',
      label: 'Cursor',
      fileName: '.cursor/mcp.json',
      text: JSON.stringify(
        { mcpServers: { soonwhy: { url: serverUrl, headers: { Authorization: `Bearer ${key}` } } } },
        null,
        2,
      ),
      note: 'Use ~/.cursor/mcp.json instead to make it available in every project. Do not commit a file that holds a real key.',
    },
    {
      id: 'codex',
      label: 'Codex',
      fileName: '~/.codex/config.toml',
      text: `[mcp_servers.soonwhy]\nurl = "${serverUrl}"\nbearer_token_env_var = "SOONWHY_MCP_KEY"\n\n# then, in your shell:\n# export SOONWHY_MCP_KEY=${key}`,
      note: 'Codex reads the key from an environment variable, so it stays out of the file.',
    },
    {
      id: 'other',
      label: 'Any other client',
      text: `Server URL:  ${serverUrl}\nTransport:   Streamable HTTP\nHeader:      Authorization: Bearer ${key}`,
      note: 'Any assistant that supports remote MCP servers over HTTP can use these three values. Copy them one by one below.',
      copyItems: [
        { label: 'Server URL', value: serverUrl },
        { label: 'Authorization header', value: `Authorization: Bearer ${key}` },
        { label: 'Key', value: key },
        {
          label: 'JSON config',
          value: JSON.stringify({ mcpServers: { soonwhy: { type: 'http', url: serverUrl, headers: { Authorization: `Bearer ${key}` } } } }, null, 2),
        },
      ],
    },
  ];
}
