import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import type { LogEntry } from '~/lib/log-types';
import { LEVEL_TREATMENT, statusBadgeClass } from '~/components/logs/log-styles';

export function parseAttributes(attributes: LogEntry['attributes']): Record<string, unknown> {
  if (typeof attributes === 'string') {
    try {
      return JSON.parse(attributes) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return attributes ?? {};
}

const REQUEST_LINE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)(?:\s+(\d{3}))?$/;

function parseRequestMessage(log: LogEntry) {
  if (log.method || log.endpoint) return null;
  const match = REQUEST_LINE.exec(log.message.trim());
  if (!match) return null;
  return { method: match[1], endpoint: match[2], status: match[3] };
}

interface LogRowProps {
  log: LogEntry;
  organizationSlug: string;
  projectSlug: string;
  onFilter: (field: string, value: string, negate: boolean) => void;
}

export function LogRow({ log, organizationSlug, projectSlug, onFilter }: LogRowProps) {
  const [expanded, setExpanded] = useState(false);
  const fields = parseAttributes(log.attributes);
  const request = parseRequestMessage(log);
  const status = log.status ?? request?.status ?? (fields['http.status_code'] as string | undefined);
  const expandable = Object.keys(fields).length > 0 || Boolean(log.traceId) || Boolean(log.stackTrace);

  return (
    <>
      <tr
        onClick={expandable ? () => setExpanded(!expanded) : undefined}
        className={`border-b border-[#242426] last:border-0 transition-colors ${expandable ? 'cursor-pointer hover:bg-[#151517]/50' : ''}`}
      >
        <td className="w-6 p-3 pr-2 text-center align-middle">
          {expandable ? (expanded ? <ChevronDown className="h-3.5 w-3.5 text-[#989898]" /> : <ChevronRight className="h-3.5 w-3.5 text-[#6E6E70]" />) : null}
        </td>
        <td className="whitespace-nowrap p-3 py-2 pl-0 text-left">
          <time className="font-mono text-[11px] text-[#989898]" title={new Date(log.timestamp).toISOString()}>{new Date(log.timestamp).toLocaleTimeString()}</time>
        </td>
        <td className="whitespace-nowrap p-3 py-2 text-left">
          <Badge variant="outline" className={`w-16 shrink-0 justify-center text-[10px] uppercase ${LEVEL_TREATMENT[log.level] ?? LEVEL_TREATMENT.debug}`}>{log.level}</Badge>
        </td>
        <td className="whitespace-nowrap p-3 py-2 text-left"><span className="text-xs font-medium text-[#ACFC15]">{log.service}</span></td>
        <td className="min-w-0 max-w-0 p-3 py-2 text-left"><span className="block truncate font-mono text-xs">{log.message}</span></td>
        <td className="whitespace-nowrap p-3 py-2 text-right">
          {status ? <Badge variant="outline" className={`w-12 shrink-0 justify-center text-[10px] ${statusBadgeClass(status)}`}>{status}</Badge> : null}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[#242426] bg-[#151517] last:border-0">
          <td colSpan={6} className="space-y-3 p-3 pl-10">
            <p className="break-words font-mono text-xs">{log.message}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button type="button" className="rounded border border-[#242426] px-2 py-1 hover:bg-[#0B0B0C]" onClick={() => onFilter('service', log.service, false)}>Only {log.service}</button>
              <button type="button" className="rounded border border-[#242426] px-2 py-1 hover:bg-[#0B0B0C]" onClick={() => onFilter('level', log.level, false)}>Only {log.level}</button>
              {log.traceId && (
                <>
                  <button type="button" className="rounded border border-[#242426] px-2 py-1 hover:bg-[#0B0B0C]" onClick={() => onFilter('traceId', log.traceId!, false)}>Logs in this trace</button>
                  <Link to="/$organizationSlug/p/$projectSlug/trace/$traceId" params={{ organizationSlug, projectSlug, traceId: log.traceId }} className="rounded border border-[#16931F] px-2 py-1 text-[#16931F] hover:bg-[#0B0B0C]">Open trace {log.traceId.slice(0, 8)}</Link>
                </>
              )}
            </div>
            {log.stackTrace && <pre className="max-h-64 overflow-auto rounded border border-[#242426] bg-[#0B0B0C] p-3 text-xs leading-5">{log.stackTrace}</pre>}
            {Object.keys(fields).length > 0 && (
              <table className="w-full text-[11px]">
                <tbody>
                  {Object.entries(fields).map(([key, value]) => (
                    <tr key={key} className="border-b border-[#242426] last:border-0">
                      <td className="py-1 pr-3 font-mono text-[#989898]">{key}</td>
                      <td className="break-all py-1 pr-3 font-mono">{String(value)}</td>
                      <td className="whitespace-nowrap py-1 text-right">
                        <button type="button" aria-label={`Include ${key}`} className="px-1 text-[#16931F]" onClick={() => onFilter(`attributes.${key}`, String(value), false)}>+</button>
                        <button type="button" aria-label={`Exclude ${key}`} className="px-1 text-[#8A1C13]" onClick={() => onFilter(`attributes.${key}`, String(value), true)}>−</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
