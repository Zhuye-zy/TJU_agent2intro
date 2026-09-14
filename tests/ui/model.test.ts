import assert from 'node:assert/strict';
import test from 'node:test';
import type { RuntimeEvent } from '../../shared/contracts.ts';
import { errorMessage, freshUuid, isCurrentOperation, mergeRuntimeEvents, safeSourceUrl, sanitizedLogExport } from '../../frontend/src/ui/model.ts';

const event = (event_id: string, seq: number, status: RuntimeEvent['status'] = 'started'): RuntimeEvent => ({
  event_id, request_id: '9a3ca5a1-5121-47ef-97a7-b2502d5f7312', seq,
  timestamp: '2026-09-14T08:00:00Z', origin: 'backend', stage: 'request', status, duration_ms: null, data: {},
});

test('clear/retry IDs never reuse the previous UUID', () => {
  const previous = freshUuid();
  assert.notEqual(freshUuid(previous), previous);
});
test('stale callbacks are rejected after request, session, or generation changes', () => {
  const expected = { sessionId: 's1', requestId: 'r1', generation: 2 };
  assert.equal(isCurrentOperation(expected, { sessionId: 's1', requestId: 'r1', generation: 2 }), true);
  assert.equal(isCurrentOperation(expected, { sessionId: 's2', requestId: 'r1', generation: 2 }), false);
  assert.equal(isCurrentOperation(expected, { sessionId: 's1', requestId: 'r2', generation: 2 }), false);
  assert.equal(isCurrentOperation(expected, { sessionId: 's1', requestId: 'r1', generation: 3 }), false);
});
test('runtime events deduplicate by origin/event id and keep the newest payload', () => {
  const merged = mergeRuntimeEvents([event('one', 1)], [event('one', 1, 'completed'), event('two', 2)]);
  assert.equal(merged.length, 2); assert.equal(merged[0].status, 'completed');
});
test('log capacity is bounded to 500 events', () => {
  const merged = mergeRuntimeEvents([], Array.from({ length: 550 }, (_, index) => event(String(index), index)));
  assert.equal(merged.length, 500); assert.equal(merged[0].seq, 50);
});
test('exports remove raw event and request identifiers', () => {
  const output = sanitizedLogExport([event('private-event-id', 1)]);
  assert.doesNotMatch(output, /private-event-id|9a3ca5a1/); assert.match(output, /request-1/);
});
test('only http(s) source URLs are linkable', () => {
  assert.equal(safeSourceUrl('javascript:alert(1)'), null);
  assert.equal(safeSourceUrl('https://www.tju.edu.cn/'), 'https://www.tju.edu.cn/');
});
test('cancel and network failures have honest user-facing states', () => {
  assert.equal(errorMessage(new DOMException('aborted', 'AbortError')), '本次请求已取消。');
  assert.equal(errorMessage(new TypeError('network down')), '请求失败，请稍后重试。');
});
