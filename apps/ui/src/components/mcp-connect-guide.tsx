import { useMemo, useState, type ComponentType } from 'react';
import { SetupCodeBlock, SetupCopyButton } from '~/components/setup-flow';
import { ClaudeCodeIcon, CodexIcon, CursorIcon } from '~/components/mcp-client-icons';
import { API_BASE, API_PREFIX } from '~/lib/config';
import { mcpClientSnippets, mcpServerUrl, type McpClientSnippet } from '~/lib/mcp-clients';
import { Braces } from 'lucide-react';

const CLIENT_ICONS: Record<McpClientSnippet['id'], ComponentType<{ className?: string }>> = {
  'claude-code': ClaudeCodeIcon,
  cursor: CursorIcon,
  codex: CodexIcon,
  other: Braces,
};

export function McpConnectGuide({ apiKey }: { apiKey?: string }) {
  const snippets = useMemo(() => mcpClientSnippets(mcpServerUrl(API_BASE, API_PREFIX), apiKey), [apiKey]);
  const [activeId, setActiveId] = useState(snippets[0]!.id);
  const active = snippets.find((snippet) => snippet.id === activeId) ?? snippets[0]!;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Create a key with MCP access, then add it to your assistant. It can read this project's errors, logs, traces and findings. It cannot change anything.
      </p>
      <div role="tablist" aria-label="Assistant" className="flex flex-wrap gap-1">
        {snippets.map((snippet) => {
          const Icon = CLIENT_ICONS[snippet.id];
          return (
            <button
              key={snippet.id}
              type="button"
              role="tab"
              aria-selected={snippet.id === active.id}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${snippet.id === active.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveId(snippet.id)}
            >
              <Icon className="h-4 w-4" />
              {snippet.label}
            </button>
          );
        })}
      </div>
      <SetupCodeBlock multiline fileName={active.fileName}>{active.text}</SetupCodeBlock>
      {active.copyItems && (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {active.copyItems.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-muted-foreground">{item.label}</span>
              <SetupCopyButton value={item.value} label={`Copy ${item.label}`} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{active.note}</p>
    </div>
  );
}
