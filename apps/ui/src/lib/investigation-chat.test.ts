import { describe, expect, it } from 'vitest';
import { EMPTY_CHAT_STATE, applyEvent, parseFrames, readChatStream, turnsAfter } from './investigation-chat';

const frame = (event: unknown) => `data: ${JSON.stringify(event)}\n\n`;

describe('parseFrames', () => {
  it('keeps an incomplete frame as the remainder', () => {
    const whole = frame({ type: 'text', delta: 'hi' });
    const { events, rest } = parseFrames(whole + whole.slice(0, 10));
    expect(events).toEqual([{ type: 'text', delta: 'hi' }]);
    expect(rest).toBe(whole.slice(0, 10));
  });

  it('skips malformed frames', () => {
    expect(parseFrames('data: {oops\n\n').events).toEqual([]);
  });
});

describe('readChatStream', () => {
  it('reassembles frames split across chunks', async () => {
    const text = frame({ type: 'text', delta: 'a' }) + frame({ type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } });
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(text.slice(0, 7)));
        controller.enqueue(encoder.encode(text.slice(7)));
        controller.close();
      },
    });
    const events = [];
    for await (const event of readChatStream(new Response(body))) events.push(event.type);
    expect(events).toEqual(['text', 'done']);
  });
});

describe('applyEvent', () => {
  it('updates a step in place and accumulates text', () => {
    let state = applyEvent(EMPTY_CHAT_STATE, { type: 'step', id: '1', tool: 'get_trace', status: 'running' });
    state = applyEvent(state, { type: 'step', id: '1', tool: 'get_trace', status: 'complete' });
    state = applyEvent(state, { type: 'text', delta: 'He' });
    state = applyEvent(state, { type: 'text', delta: 'llo' });
    expect(state.steps).toEqual([{ id: '1', tool: 'get_trace', status: 'complete', detail: undefined }]);
    expect(state.text).toBe('Hello');
  });

  it('records an error and finishes', () => {
    const state = applyEvent(EMPTY_CHAT_STATE, { type: 'error', message: 'nope' });
    expect(state).toMatchObject({ done: true, error: 'nope' });
  });
});

describe('thread handling', () => {
  it('captures the thread id from the first event', () => {
    expect(applyEvent(EMPTY_CHAT_STATE, { type: 'thread', threadId: 't1' }).threadId).toBe('t1');
  });

  it('appends the question and the finished answer as turns', () => {
    const live = applyEvent(applyEvent(EMPTY_CHAT_STATE, { type: 'text', delta: 'Because X.' }), { type: 'done', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } });
    const turns = turnsAfter([], 'Why?', live);
    expect(turns.map((turn) => [turn.role, turn.content, turn.status])).toEqual([
      ['user', 'Why?', 'complete'],
      ['assistant', 'Because X.', 'complete'],
    ]);
  });

  it('marks a stopped answer as cancelled and any other error as failed', () => {
    const stopped = applyEvent(EMPTY_CHAT_STATE, { type: 'error', message: 'Investigation stopped.' });
    const broken = applyEvent(EMPTY_CHAT_STATE, { type: 'error', message: 'The model could not complete this investigation.' });
    expect(turnsAfter([], 'q', stopped)[1]?.status).toBe('cancelled');
    expect(turnsAfter([], 'q', broken)[1]?.status).toBe('failed');
  });
});
