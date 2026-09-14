import type { ApiError, RuntimeEvent } from '../../../shared/contracts';

export const LOG_LIMIT = 500;

export function freshUuid(previous?: string): string {
  let value = crypto.randomUUID();
  while (value === previous) value = crypto.randomUUID();
  return value;
}

export function isCurrentOperation(
  expected: { sessionId: string; requestId: string; generation: number },
  current: { sessionId: string; requestId: string | null; generation: number },
): boolean {
  return expected.sessionId === current.sessionId
    && expected.requestId === current.requestId
    && expected.generation === current.generation;
}

export function mergeRuntimeEvents(current: RuntimeEvent[], incoming: RuntimeEvent[]): RuntimeEvent[] {
  const byKey = new Map<string, RuntimeEvent>();
  for (const event of [...current, ...incoming]) byKey.set(`${event.origin}:${event.event_id}`, event);
  return [...byKey.values()].sort((a, b) => a.seq - b.seq).slice(-LOG_LIMIT);
}

export function safeSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch { return null; }
}

export function errorMessage(error: unknown, fallback = '请求失败，请稍后重试。'): string {
  const apiError = error as Partial<ApiError>;
  const message = apiError?.error?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (error instanceof DOMException && error.name === 'AbortError') return '本次请求已取消。';
  return fallback;
}

export function sanitizedLogExport(events: RuntimeEvent[]): string {
  const requestAliases = new Map<string, string>();
  const output = events.map((event) => {
    if (!requestAliases.has(event.request_id)) requestAliases.set(event.request_id, `request-${requestAliases.size + 1}`);
    return {
      request: requestAliases.get(event.request_id), timestamp: event.timestamp, source: event.origin,
      stage: event.stage, status: event.status, duration_ms: event.duration_ms, data: event.data,
    };
  });
  return JSON.stringify({ exported_at: new Date().toISOString(), events: output }, null, 2);
}
