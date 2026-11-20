import type { ProjectSpend } from './ai-spend.types';

export function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

export function formatUsd(value: number): string {
  if (value >= 0.01) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

export function projectTokens(project: ProjectSpend): number {
  return project.rcaTokens + project.chatTokens;
}

export function costShare(project: ProjectSpend, projects: ProjectSpend[]): number {
  const total = projects.reduce((sum, item) => sum + item.costUsd, 0);
  if (total > 0) return project.costUsd / total;
  const tokens = projects.reduce((sum, item) => sum + projectTokens(item), 0);
  return tokens > 0 ? projectTokens(project) / tokens : 0;
}
