import { describe, expect, it } from 'vitest';
import { IssueStatusActions, IssueStatusBadge } from '~/components/errors/issue-status';
import { StackTraceView } from '~/components/errors/stack-trace-view';
import { TraceExceptionView } from '~/components/errors/trace-exception-view';
import type { ErrorIssueState } from '~/lib/error-groups';
import { renderHtml } from '~/test-utils/render-html';

const STACK = [
  'TypeError: boom',
  '    at placeOrder (/app/src/orders.ts:42:7)',
  '    at Layer.handle (/app/node_modules/express/lib/router/layer.js:95:5)',
].join('\n');

function issue(status: ErrorIssueState['status']): ErrorIssueState {
  return { status } as ErrorIssueState;
}

describe('IssueStatusBadge', () => {
  it.each([
    ['unresolved', 'Unresolved'],
    ['regressed', 'Regressed'],
    ['resolved', 'Resolved'],
    ['ignored', 'Ignored'],
  ] as const)('shows the %s label', (status, label) => {
    expect(renderHtml(<IssueStatusBadge status={status} />)).toContain(label);
  });
});

describe('IssueStatusActions', () => {
  it('offers Resolve and Ignore on an open issue', () => {
    const html = renderHtml(<IssueStatusActions projectId="p1" fingerprint="f1" issue={issue('unresolved')} />);
    expect(html).toContain('Resolve');
    expect(html).toContain('Ignore');
    expect(html).not.toContain('Reopen');
  });

  it('offers Reopen on a resolved issue', () => {
    const html = renderHtml(<IssueStatusActions projectId="p1" fingerprint="f1" issue={issue('resolved')} />);
    expect(html).toContain('Reopen');
    expect(html).not.toContain('Ignore');
  });

  it('offers Reopen on an ignored issue', () => {
    const html = renderHtml(<IssueStatusActions projectId="p1" fingerprint="f1" issue={issue('ignored')} />);
    expect(html).toContain('Reopen');
  });

  it('shows no error message before anything is tried', () => {
    const html = renderHtml(<IssueStatusActions projectId="p1" fingerprint="f1" issue={issue('regressed')} />);
    expect(html).not.toContain('Could not update the status');
  });
});

describe('StackTraceView', () => {
  it('shows app frames and hides library frames by default', () => {
    const html = renderHtml(<StackTraceView stack={STACK} />);
    expect(html).toContain('placeOrder');
    expect(html).toContain('/app/src/orders.ts:42:7');
    expect(html).not.toContain('Layer.handle');
    expect(html).toContain('1 library and internal frame hidden');
    expect(html).toContain('Show all frames');
  });

  it('falls back to plain text when there are no frames', () => {
    const html = renderHtml(<StackTraceView stack="something went wrong" />);
    expect(html).toContain('<pre');
    expect(html).toContain('something went wrong');
  });

  it('escapes markup inside a stack', () => {
    const html = renderHtml(<StackTraceView stack="<img src=x onerror=alert(1)>" />);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});

describe('TraceExceptionView', () => {
  const exception = { type: 'TimeoutError', message: 'upstream slow', stacktrace: STACK, spanName: 'GET /orders', spanId: 's1' };

  it('explains where the exception came from', () => {
    const html = renderHtml(<TraceExceptionView exception={exception} />);
    expect(html).toContain('carries no stack');
    expect(html).toContain('GET /orders');
    expect(html).toContain('TimeoutError: upstream slow');
    expect(html).toContain('placeOrder');
  });

  it('omits the stack and span name when missing', () => {
    const html = renderHtml(<TraceExceptionView exception={{ ...exception, stacktrace: '', spanName: '' }} />);
    expect(html).toContain('TimeoutError: upstream slow');
    expect(html).not.toContain('Show all frames');
    expect(html).not.toContain(' in <span');
  });
});
