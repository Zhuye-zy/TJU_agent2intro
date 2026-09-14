import assert from 'node:assert/strict';
import test from 'node:test';
import { createParser } from 'eventsource-parser';
import type { ChatResponse } from '../../shared/contracts.ts';
import type { POI, StreamEvent } from '../../shared/r2.ts';
import { classifyAmapLocation } from '../../frontend/src/ui/navigation-model.ts';
import { applyStreamEvent, campusMediaFor, consumeR2Stream, exportGeneratedText, mergePoiPages, newTask, readableParagraphs, shouldFollowLatest, StreamTaskError, validateGenerationDraft, responseWithDeadline } from '../../frontend/src/ui/r2-model.ts';

const requestId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
const messageId = '33333333-3333-4333-8333-333333333333';
const response: ChatResponse = { request_id: requestId, session_id: sessionId, answer: '完整校园内容', sources: [], model: 'glm-5.1', usage: null, elapsed_ms: 120, actions: [] };

function wire(type: StreamEvent['type'], payload: unknown, seq: number, eventId = `event-${seq}`): string {
  return `id: ${eventId}\nevent: ${type}\ndata: ${JSON.stringify({ event_id: eventId, request_id: requestId, seq, type, timestamp: '2026-09-14T08:00:00Z', payload })}\n\n`;
}
function streamResponse(records: string[], split = false): Response {
  const bytes = new TextEncoder().encode(records.join(''));
  return new Response(new ReadableStream({ start(controller) { if (split) { const middle = Math.floor(bytes.length / 2); controller.enqueue(bytes.slice(0, middle)); controller.enqueue(bytes.slice(middle)); } else controller.enqueue(bytes); controller.close(); } }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}
const expected = { sessionId, messageId, campusId: 'weijinlu', mode: 'content_generation' };
const accepted = () => wire('accepted', { session_id: sessionId, message_id: messageId, campus_id: 'weijinlu', mode: 'content_generation' }, 1);

test('successful stream updates one task, deduplicates events and completes with non-empty text', async () => {
  let task = newTask(requestId, messageId); let count = 0;
  const records = [wire('accepted', { session_id: sessionId, message_id: messageId, campus_id: 'weijinlu', mode: 'content_generation' }, 1), wire('answer_delta', { text: '完整' }, 2), wire('answer_delta', { text: '完整' }, 2), wire('answer_delta', { text: '校园内容' }, 3), wire('completed', { response }, 4)];
  const result = await consumeR2Stream(streamResponse(records, true), requestId, new AbortController().signal, (event) => { count += 1; task = applyStreamEvent(task, event); }, createParser, { expected });
  assert.equal(result.answer, '完整校园内容'); assert.equal(task.phase, 'complete'); assert.equal(task.answer, '完整校园内容'); assert.equal(count, 4);
});

test('HTTP failure exposes a sanitized backend error', async () => {
  const failed = new Response(JSON.stringify({ error: { code: 'model_failed', message: 'Authorization: Bearer private https://secret.invalid/path' } }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(() => consumeR2Stream(failed, requestId, new AbortController().signal, () => undefined, createParser), (error: unknown) => error instanceof StreamTaskError && error.code === 'model_failed' && !error.message.includes('private') && !error.message.includes('secret.invalid'));
});

test('HTTP 200 with empty completed body is not success', async () => {
  const empty = { ...response, answer: '' };
  await assert.rejects(() => consumeR2Stream(streamResponse([wire('accepted', { session_id: sessionId, message_id: messageId, campus_id: 'weijinlu', mode: 'content_generation' }, 1), wire('completed', { response: empty }, 2)]), requestId, new AbortController().signal, () => undefined, createParser, { expected }), (error: unknown) => error instanceof StreamTaskError && error.code === 'EMPTY_ANSWER');
});

test('backend error, cancellation and disconnect are distinct terminal states', async () => {
  await assert.rejects(() => consumeR2Stream(streamResponse([accepted(), wire('answer_delta', { text: '部分' }, 2), wire('error', { code: 'INCOMPLETE_OUTPUT', message: '连接中断', retryable: true, partial: true, answer: '部分', reason: 'disconnect' }, 3)]), requestId, new AbortController().signal, () => undefined, createParser), (error: unknown) => error instanceof StreamTaskError && error.partial && error.answer === '部分');
  await assert.rejects(() => consumeR2Stream(streamResponse([accepted(), wire('cancelled', { local_task_stopped: true, upstream_stop: 'unconfirmed' }, 2)]), requestId, new AbortController().signal, () => undefined, createParser), (error: unknown) => error instanceof StreamTaskError && error.reason === 'cancelled');
  await assert.rejects(() => consumeR2Stream(streamResponse([accepted(), wire('answer_delta', { text: '未完成' }, 2)]), requestId, new AbortController().signal, () => undefined, createParser), (error: unknown) => error instanceof StreamTaskError && error.reason === 'disconnect');
});

test('stream rejects content before accepted and paragraph reading keeps complete blocks', async () => {
  await assert.rejects(() => consumeR2Stream(streamResponse([wire('answer_delta', { text: '越序正文' }, 1)]), requestId, new AbortController().signal, () => undefined, createParser), (error: unknown) => error instanceof StreamTaskError && error.code === 'STREAM_PROTOCOL_ERROR');
  assert.deepEqual(readableParagraphs('第一段\n仍是第一段\n\n第二段'), ['第一段\n仍是第一段', '第二段']);
});

test('idle timeout stops an endless stream instead of spinning forever', async () => {
  let cancelled = false;
  const never = new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status: 200 });
  await assert.rejects(() => consumeR2Stream(never, requestId, new AbortController().signal, () => undefined, createParser, { visibleIdleMs: 15, totalTimeoutMs: 30 }), (error: unknown) => error instanceof StreamTaskError && error.reason === 'timeout');
  assert.equal(cancelled, true);
});

test('chat/generation task ownership ignores events for another request and preserves long text', () => {
  const chat = newTask('chat-request', messageId); const generation = newTask('generation-request', messageId); const longText = '天'.repeat(22000);
  const foreign = { event_id: 'x', request_id: 'generation-request', seq: 1, type: 'answer_delta', timestamp: '', payload: { text: longText } } as StreamEvent;
  assert.equal(applyStreamEvent(chat, foreign).answer, ''); assert.equal(applyStreamEvent(generation, foreign).answer.length, 22000);
});

test('generation form, export, history following and campus photos have honest conditions', async () => {
  assert.equal(validateGenerationDraft({ prompt: '', type: 'guide_script', requirements: '', length: 'short', style: 'friendly' }), '请先说明要生成的校园内容。');
  assert.equal(exportGeneratedText(newTask(requestId, messageId)), null);
  const finished = { ...newTask(requestId, messageId), answer: '可导出的正文' }; const blob = exportGeneratedText(finished); assert.ok(blob); assert.equal(await blob!.text(), '可导出的正文');
  assert.equal(shouldFollowLatest(300, 1000, 600), false); assert.equal(shouldFollowLatest(360, 1000, 600), true);
  const media = { id: 'm1', campus_id: 'weijinlu', local_path: '/assets/campus/a.jpg', source_url: 'https://tju.edu.cn/a', creator: null, usage_basis: '许可', caption: '卫津路', focal_point: [.5, .5], width: 1, height: 1 } as const;
  assert.equal(campusMediaFor({ maps: [], media: [media], version: '1' }, 'beiyangyuan'), null); assert.equal(campusMediaFor({ maps: [], media: [media], version: '1' }, 'weijinlu')?.id, 'm1');
});

test('POI pagination is stable-id deduplicated and location quality is explicit', () => {
  const poi = { id: 'p1', name: '一号点', campus_id: 'weijinlu' } as POI; const updated = { ...poi, name: '更新名称' } as POI;
  assert.deepEqual(mergePoiPages([poi], [updated, { ...poi, id: 'p2' }]), [updated, { ...poi, id: 'p2' }]);
  const coarse = classifyAmapLocation({ position: { lng: 117, lat: 39 }, accuracy: 3000, location_type: 'ip' }); assert.ok(!(coarse instanceof Error) && coarse.coarse && coarse.sourceLabel.includes('IP'));
  const precise = classifyAmapLocation({ position: { lng: 117, lat: 39 }, accuracy: 20, location_type: 'gps' }); assert.ok(!(precise instanceof Error) && !precise.coarse);
});

test('A03 terminal frame is immutable and authoritative sources replace retrieval', async () => {
  await assert.rejects(() => consumeR2Stream(streamResponse([accepted(),wire('completed',{response},2),wire('answer_delta',{text:'late'},3)]),requestId,new AbortController().signal,()=>undefined,createParser), (error:unknown)=>error instanceof StreamTaskError && error.code==='STREAM_PROTOCOL_ERROR');
  const completed=applyStreamEvent({...newTask(requestId,messageId),sources:[{id:'retrieved-only'} as any]}, {request_id:requestId,type:'completed',payload:{response}} as any);
  assert.deepEqual(completed.sources,[]);
  assert.equal(applyStreamEvent(completed,{request_id:requestId,type:'answer_delta',payload:{text:'late'}} as any).answer,response.answer);
});
test('A02 headers deadline and cancellation settle even if network ignores abort', async () => {
  const controller=new AbortController();
  await assert.rejects(()=>responseWithDeadline(()=>new Promise(()=>{}),controller,15),(error:unknown)=>error instanceof StreamTaskError && error.reason==='timeout');
  assert.equal(controller.signal.aborted,true);
  const cancelled=new AbortController();
  const pending=responseWithDeadline(()=>new Promise(()=>{}),cancelled,1000);
  cancelled.abort();
  await assert.rejects(()=>pending,(error:unknown)=>error instanceof StreamTaskError && error.reason==='cancelled');
});
