import { describe, expect, it } from 'vitest';
import { ignoreRuleBody, ignoreRuleProblem } from './ignore-rules';

describe('ignoreRuleProblem', () => {
  it('accepts a path with no status', () => {
    expect(ignoreRuleProblem({ pathPattern: '/internal/*', status: '' })).toBeNull();
  });
  it('requires a leading slash', () => {
    expect(ignoreRuleProblem({ pathPattern: 'internal', status: '' })).toMatch(/start with/);
  });
  it('rejects a rule that matches every path', () => {
    expect(ignoreRuleProblem({ pathPattern: '/*', status: '' })).toMatch(/every path/);
  });
  it('rejects a malformed status', () => {
    expect(ignoreRuleProblem({ pathPattern: '/a', status: '4' })).toMatch(/three-digit/);
  });
});

describe('ignoreRuleBody', () => {
  it('sends null for an empty status', () => {
    expect(ignoreRuleBody({ pathPattern: ' /a ', status: ' ' })).toEqual({ pathPattern: '/a', status: null });
  });
});
