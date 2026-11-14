import { useMemo, useState } from 'react';
import { SetupCodeBlock } from '~/components/setup-flow';
import { API_BASE, API_PREFIX } from '~/lib/config';
import { mcpClientSnippets, mcpServerUrl } from '~/lib/mcp-clients';

export function McpConnectGuide({ apiKey, defaultOpen = false }: { apiKey?: string; defaultOpen?: boolean }) {
  const snippets = useMemo(() => mcpClientSnippets(mcpServerUrl(API_BASE, API_PREFIX), apiKey), [apiKey]);
  const [activeId, setActiveId] = useState(snippets[0]!.id);
  const active = snippets.find((snippet) => snippet.id === activeId) ?? snippets[0]!;

  return (
    <details open={defaultOpen} className="rounded-xl border border-border p-4">
      <summary className="cursor-pointer text-sm font-semibold">Connect an AI assistant</summary>
      <div className="mt-3 space-y-3">
        <p className="text-sm text-muted-foreground">
          Create a key with MCP access, then add it to your assistant. It can read this project's errors, logs, traces and findings. It cannot change anything.
        </p>
        <div role="tablist" aria-label="Assistant" className="flex gap-1">
          {snippets.map((snippet) => (
            <button
              key={snippet.id}
              type="button"
              role="tab"
              aria-selected={snippet.id === active.id}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${snippet.id === active.id ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setActiveId(snippet.id)}
            >
              {snippet.label}
            </button>
          ))}
        </div>
        <SetupCodeBlock multiline fileName={active.fileName}>{active.text}</SetupCodeBlock>
        <p className="text-xs text-muted-foreground">{active.note}</p>
      </div>
    </details>
  );
}
