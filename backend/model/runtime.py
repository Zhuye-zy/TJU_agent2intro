"""C-owned bounded in-memory runtime. Not a durable audit database."""
import asyncio
import time
import json
import os
from pathlib import Path
from collections import OrderedDict, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4
from backend.common.errors import DomainError
from backend.contracts import RuntimeEvent, EventData, EventPage, SceneAction, SceneAck, SceneAckResponse, ClientEventInput
from backend.r2_contracts import GenerationRendered, RenderReceipt
from backend.knowledge.service import knowledge
@dataclass
class RequestRecord:
    session_id: UUID
    created: float = field(default_factory=time.monotonic)
    status: str = "running"
    cancel_requested: bool = False
    upstream_stop: str = "not_started"
    task: asyncio.Task | None = None
    actions: dict = field(default_factory=dict)
    acks: dict = field(default_factory=dict)
    message_id: UUID | None = None
    campus_id: str | None = None
    mode: str | None = None
    generation_type: str | None = None
    answer_chars: int = 0
    terminal_count: int = 0
class RuntimeStore:
    def __init__(self):
        self.records: OrderedDict[UUID, RequestRecord] = OrderedDict()
        self.events: deque[RuntimeEvent] = deque(maxlen=2000)
        self.client_ids: OrderedDict[UUID, tuple] = OrderedDict()
        self.render_ids: OrderedDict[UUID, tuple] = OrderedDict()
        self.traces: deque[dict] = deque(maxlen=4000)
        self.seq = 0
    def begin(self, request_id: UUID, session_id: UUID):
        now = time.monotonic()
        for key, record in list(self.records.items()):
            if record.status != "running" and now-record.created > 3600:
                del self.records[key]
        if request_id in self.records:
            raise DomainError("duplicate_request_id", "请求 ID 已使用；重试请生成新 ID", 409, request_id)
        if any(r.session_id == session_id and r.status == "running" for r in self.records.values()):
            raise DomainError("session_busy", "同一会话已有运行请求", 409, request_id)
        if sum(r.status == "running" for r in self.records.values()) >= 128:
            raise DomainError("capacity_exceeded", "运行请求达到容量上限", 429, request_id, True)
        while len(self.records) >= 1024:
            terminal = next((key for key, r in self.records.items() if r.status != "running"), None)
            if terminal is None:
                raise DomainError("capacity_exceeded", "请求记录已满", 429, request_id, True)
            del self.records[terminal]
        self.records[request_id] = RequestRecord(session_id=session_id, task=asyncio.current_task())
        return self.records[request_id]
    def attach_task(self, request_id: UUID):
        record = self.get(request_id)
        record.task = asyncio.current_task()
        return record
    def configure_generation(self, request_id: UUID, message_id: UUID, campus_id: str, mode: str, generation_type: str | None):
        record = self.get(request_id)
        record.message_id, record.campus_id, record.mode = message_id, campus_id, mode
        record.generation_type = generation_type
    def finish(self, request_id: UUID, status: str, answer_chars: int = 0) -> bool:
        record = self.get(request_id)
        if record.status != "running":
            return False
        record.status, record.answer_chars = status, answer_chars
        record.terminal_count += 1
        record.task = None
        return True
    def trace(self, request_id: UUID, *, action: str, stage: str, status: str, attempt: int = 1,
              generation_type: str | None = None, elapsed_ms: float | None = None,
              upstream_http_status: int | None = None, finish_reason: str | None = None,
              body_chars: int | None = None, usage: dict | None = None, content_type: str | None = None):
        self.get(request_id)
        entry = {"request_id": str(request_id), "action": action, "generation_type": generation_type,
                 "attempt": attempt, "stage": stage, "status": status,
                 "monotonic_ms": round(time.monotonic() * 1000, 3), "elapsed_ms": elapsed_ms,
                 "upstream_http_status": upstream_http_status, "finish_reason": finish_reason,
                 "body_chars": body_chars, "usage": usage, "content_type": content_type}
        self.traces.append(entry)
        if "PYTEST_CURRENT_TEST" not in os.environ:
            path = Path(".runtime/model-r2.jsonl")
            path.parent.mkdir(exist_ok=True)
            with path.open("a", encoding="utf-8") as output:
                output.write(json.dumps(entry, ensure_ascii=False, separators=(",", ":")) + "\n")
        return entry
    def get(self, request_id: UUID, session_id: UUID | None = None):
        record = self.records.get(request_id)
        if not record:
            raise DomainError("request_not_found", "请求记录不存在或已过保留期", 404, request_id)
        if session_id is not None and record.session_id != session_id:
            raise DomainError("session_mismatch", "会话与请求不匹配", 409, request_id)
        return record
    def emit(self, request_id, stage, status, data=None, duration_ms=None, origin="backend", event_id=None):
        self.seq += 1
        event = RuntimeEvent(event_id=event_id or uuid4(), request_id=request_id, seq=self.seq,
            timestamp=datetime.now(timezone.utc).isoformat(), origin=origin, stage=stage, status=status,
            duration_ms=duration_ms, data=EventData(**(data or {})))
        self.events.append(event)
        return event
    def page(self, request_id: UUID, cursor: int):
        self.get(request_id)
        if cursor > self.seq:
            raise DomainError("invalid_cursor", "游标超过当前日志位置", 422, request_id)
        return EventPage(events=[e for e in self.events if e.request_id == request_id and e.seq > cursor],
            next_cursor=self.seq, truncated=bool(self.events and cursor < self.events[0].seq-1))
    def publish(self, action: SceneAction, session_id: UUID, campus_id: str):
        record = self.get(action.request_id, session_id)
        building = knowledge.get_building(action.parameters.building_id)
        if not building or building.campus_id != campus_id:
            raise DomainError("building_not_found", "动作建筑不存在或校区不匹配", 422, action.request_id)
        if len(record.actions) >= 16 or action.action_id in record.actions:
            raise DomainError("invalid_action", "动作重复或超过每请求16个上限", 409, action.request_id)
        if record.status != "running" or record.cancel_requested:
            raise DomainError("request_terminal", "终态请求不能发布动作", 409, action.request_id)
        record.actions[action.action_id] = action
        self.emit(action.request_id, "scene", "started", {"action_id": str(action.action_id), "building_id": building.id})
    def acknowledge(self, ack: SceneAck):
        record = self.get(ack.request_id, ack.session_id)
        if ack.action_id not in record.actions:
            raise DomainError("action_not_published", "动作未由后端发布", 404, ack.request_id)
        if record.status == "cancelled" or record.cancel_requested:
            raise DomainError("request_terminal", "已取消请求不接受新场景回执", 409, ack.request_id)
        if (ack.status == "completed" and ack.error_code is not None) or (ack.status == "failed" and ack.error_code is None):
            raise DomainError("invalid_ack", "成功回执不得带错误，失败回执须带错误码", 422, ack.request_id)
        payload = ack.model_dump(mode="json")
        if ack.action_id in record.acks:
            if record.acks[ack.action_id] != payload:
                raise DomainError("ack_conflict", "重复回执内容冲突", 409, ack.request_id)
            return SceneAckResponse(request_id=ack.request_id, action_id=ack.action_id, status="duplicate")
        record.acks[ack.action_id] = payload
        self.emit(ack.request_id, "scene", ack.status, {"action_id": str(ack.action_id), "code": ack.error_code} if ack.error_code else {"action_id": str(ack.action_id)})
        return SceneAckResponse(request_id=ack.request_id, action_id=ack.action_id, status="recorded")
    def client_event(self, body: ClientEventInput):
        self.get(body.request_id, body.session_id)
        payload = body.model_dump(mode="json")
        existing = self.client_ids.get(body.event_id)
        if existing:
            if existing[0] != payload:
                raise DomainError("event_conflict", "重复事件内容冲突", 409, body.request_id)
            return existing[1]
        event = self.emit(body.request_id, body.stage, body.status, body.data.model_dump(exclude_none=True),
            body.duration_ms, "frontend", body.event_id)
        self.client_ids[body.event_id] = (payload, event)
        while len(self.client_ids) > 1024:
            self.client_ids.popitem(last=False)
        return event
    def generation_rendered(self, body: GenerationRendered):
        record = self.get(body.request_id, body.session_id)
        if record.mode != "content_generation" or record.status != "completed" or record.answer_chars <= 0:
            raise DomainError("render_not_allowed", "请求没有可确认的完整生成结果", 409, body.request_id)
        if record.message_id != body.message_id or record.campus_id != body.campus_id or record.answer_chars != body.answer_chars:
            raise DomainError("render_mismatch", "渲染回执与生成结果不匹配", 409, body.request_id)
        payload = body.model_dump(mode="json")
        existing = self.render_ids.get(body.event_id)
        if existing:
            if existing[0] != payload:
                raise DomainError("render_conflict", "重复渲染回执内容冲突", 409, body.request_id)
            return RenderReceipt(event_id=body.event_id, request_id=body.request_id, status="duplicate")
        if any(item[0]["request_id"] == str(body.request_id) and item[0]["message_id"] == str(body.message_id)
               for item in self.render_ids.values()):
            raise DomainError("render_conflict", "该生成结果已有渲染回执", 409, body.request_id)
        self.emit(body.request_id, "generation", "rendered", {"count": body.answer_chars}, origin="frontend", event_id=body.event_id)
        receipt = RenderReceipt(event_id=body.event_id, request_id=body.request_id, status="recorded")
        self.render_ids[body.event_id] = (payload, receipt)
        while len(self.render_ids) > 1024:
            self.render_ids.popitem(last=False)
        return receipt
runtime = RuntimeStore()
