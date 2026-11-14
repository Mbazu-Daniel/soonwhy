import { describe, expect, it } from 'vitest';
import { parseFrame, parseStackTrace } from './stack-trace';

const STACK = [
  'Error: query failed',
  '    at UsersService.find (/app/src/users/users.service.ts:42:11)',
  '    at /app/node_modules/express/lib/router/layer.js:95:5',
  '    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)',
  'Caused by: Error: connection refused',
  '    at connect (/app/node_modules/pg/lib/client.js:10:3)',
].join('\n');

describe('parseStackTrace', () => {
  it('splits the cause chain into sections', () => {
    const sections = parseStackTrace(STACK);
    expect(sections).toHaveLength(2);
    expect(sections[0]?.header).toBe('Error: query failed');
    expect(sections[1]).toMatchObject({ isCause: true, header: 'Error: connection refused' });
  });

  it('classifies app, library and internal frames', () => {
    const origins = parseStackTrace(STACK)[0]?.frames.map((frame) => frame.origin);
    expect(origins).toEqual(['app', 'library', 'internal']);
  });

  it('reads function, file, line and column', () => {
    expect(parseFrame('at UsersService.find (/app/src/users/users.service.ts:42:11)')).toMatchObject({
      fn: 'UsersService.find',
      file: '/app/src/users/users.service.ts',
      line: 42,
      column: 11,
    });
  });

  it('parses browser style frames', () => {
    expect(parseFrame('render@https://app.test/assets/index.js:10:20')).toMatchObject({ fn: 'render', line: 10, column: 20, origin: 'app' });
  });

  it('keeps unparseable text as a header', () => {
    expect(parseStackTrace('just a message')).toEqual([{ header: 'just a message', frames: [], isCause: false }]);
  });
});
