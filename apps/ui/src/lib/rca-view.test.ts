import { describe, expect, it } from 'vitest';
import { NOT_ESTABLISHED, firstSentence, splitVerify } from './rca-view';

describe('rca view helpers', () => {
  it('splits a candidate step into action and verification', () => {
    expect(splitVerify('Candidate: add logging to the handler — verify first that it is not already logged.')).toEqual({
      action: 'add logging to the handler',
      verify: 'that it is not already logged.',
    });
  });

  it('keeps steps without a verification clause whole', () => {
    expect(splitVerify('Review the middleware config')).toEqual({ action: 'Review the middleware config', verify: '' });
  });

  it('takes the first sentence of a summary', () => {
    expect(firstSentence('One thing happened. Then more.')).toBe('One thing happened.');
    expect(firstSentence('No terminator')).toBe('No terminator');
  });

  it('detects an unestablished root cause', () => {
    expect(NOT_ESTABLISHED.test('Not established. Evidence is missing.')).toBe(true);
    expect(NOT_ESTABLISHED.test('The handler throws.')).toBe(false);
  });
});
