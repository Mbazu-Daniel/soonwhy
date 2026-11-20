import { describe, expect, it } from 'vitest';
import { costShare, formatTokens, formatUsd, projectTokens } from './ai-spend';
import type { ProjectSpend } from './ai-spend.types';

function project(partial: Partial<ProjectSpend>): ProjectSpend {
  return { projectId: 'p', name: 'P', slug: 'p', runs: 0, rcaTokens: 0, chatTokens: 0, costUsd: 0, ...partial };
}

describe('formatUsd', () => {
  it('shows cents for normal amounts and four decimals for tiny ones', () => {
    expect(formatUsd(1.5)).toBe('$1.50');
    expect(formatUsd(0.004)).toBe('$0.0040');
    expect(formatUsd(0)).toBe('$0.0000');
  });
});

describe('formatTokens', () => {
  it('abbreviates thousands and millions', () => {
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(12_400)).toBe('12k');
    expect(formatTokens(2_500_000)).toBe('2.5M');
  });
});

describe('projectTokens', () => {
  it('adds analysis and chat tokens', () => {
    expect(projectTokens(project({ rcaTokens: 900, chatTokens: 100 }))).toBe(1_000);
  });
});

describe('costShare', () => {
  it('divides by total cost when there is any', () => {
    const list = [project({ costUsd: 3 }), project({ costUsd: 1 })];
    expect(costShare(list[0]!, list)).toBe(0.75);
    expect(costShare(list[1]!, list)).toBe(0.25);
  });

  it('falls back to tokens when nothing has a cost', () => {
    const list = [project({ chatTokens: 300 }), project({ chatTokens: 100 })];
    expect(costShare(list[0]!, list)).toBe(0.75);
  });

  it('is zero when there is no usage at all', () => {
    const list = [project({})];
    expect(costShare(list[0]!, list)).toBe(0);
  });
});
