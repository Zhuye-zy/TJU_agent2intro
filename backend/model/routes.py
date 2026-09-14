import asyncio
import time
from uuid import UUID
from fastapi import APIRouter, Query
from backend.common.errors import DomainError
from backend.contracts import ChatRequest, ChatResponse, EventPage, CancelRequest, CancelResponse, SceneAck, SceneAckResponse, ClientEventInput, RuntimeEvent
from backend.knowledge.service import knowledge
from .service import model
from .runtime import runtime
router = APIRouter(prefix="/api", tags=["model-runtime"])
@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    record = runtime.begin(request.request_id, request.session_id)
    started = time.monotonic()
    runtime.emit(request.request_id, "request", "started")
    try:
        if request.selected_building_id:
            building = knowledge.get_building(request.selected_building_id)
            if not building or building.campus_id != request.campus_id:
                raise DomainError("building_not_found", "建筑不存在或不属于所选校区", 422, request.request_id)
        response = await model.generate(request)
        commit = getattr(model, "commit", None)
        if commit is not None:
            commit(request, response)
        record.status = "completed"
        runtime.emit(request.request_id, "request", "completed", duration_ms=(time.monotonic()-started)*1000)
        return response
    except asyncio.CancelledError:
        record.status = "cancelled"
        runtime.emit(request.request_id, "request", "cancelled", duration_ms=(time.monotonic()-started)*1000)
        raise DomainError("request_cancelled", "本地请求已取消；上游停止状态须单独确认", 499, request.request_id)
    except Exception as error:
        record.status = "failed"
        code = error.code if isinstance(error, DomainError) else "internal_error"
        runtime.emit(request.request_id, "request", "failed", {"code": code}, (time.monotonic()-started)*1000)
        if isinstance(error, DomainError):
            raise
        raise DomainError("internal_error", "请求处理失败", 500, request.request_id) from None
    finally:
        record.task = None
@router.get("/runtime/events", response_model=EventPage)
def events(request_id: UUID, cursor: int = Query(0, ge=0)):
    return runtime.page(request_id, cursor)
@router.post("/requests/{request_id}/cancel", response_model=CancelResponse)
async def cancel(request_id: UUID, body: CancelRequest):
    record = runtime.get(request_id, body.session_id)
    running = record.status == "running"
    if running and record.task:
        record.task.cancel()
    return CancelResponse(request_id=request_id, status="cancel_requested" if running else "already_terminal",
        local_task_stopped=not running, upstream_stop=record.upstream_stop)
@router.post("/scene/ack", response_model=SceneAckResponse)
async def ack(body: SceneAck):
    return runtime.acknowledge(body)
@router.post("/runtime/client-events", response_model=RuntimeEvent)
async def client_events(body: ClientEventInput):
    return runtime.client_event(body)
