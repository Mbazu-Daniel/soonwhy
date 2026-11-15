import { useQuery } from "@tanstack/react-query";
import { api } from "~/lib/api";
import { AI_CREDENTIALS_KEY } from "~/lib/ai-providers.constants";
import type { AiCredentialList } from "~/lib/ai-providers.types";

export function ProviderSwitch({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (credentialId: string) => void;
  className?: string;
}) {
  const list = useQuery({
    queryKey: AI_CREDENTIALS_KEY,
    queryFn: () => api.get<AiCredentialList>("/ai/credentials"),
    staleTime: 30_000,
  });
  const credentials = list.data?.credentials ?? [];
  if (credentials.length < 2) return null;
  const fallback = credentials.find((item) => item.isDefault);

  return (
    <select
      aria-label="AI provider"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`rounded-md border border-border bg-background px-2 py-1.5 text-xs ${className}`}
    >
      <option value="">
        {fallback ? `Default · ${fallback.name} · ${fallback.model}` : "Default"}
      </option>
      {credentials.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name} · {item.model}
        </option>
      ))}
    </select>
  );
}
