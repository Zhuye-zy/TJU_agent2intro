import asyncio
import time
from uuid import UUID
from fastapi import APIRouter, Query
from backend.common.errors import DomainError
from backend.contracts import ChatRequest, ChatResponse, EventPage, CancelRequest, CancelResponse, SceneAck, SceneAckResponse, ClientEventInput, RuntimeEvent
from backend.r2_contracts import R2ChatRequest
from backend.knowledge.service import knowledge
from .service import model
from .runtime import runtime
router = APIRouter(prefix="/api", tags=["model-runtime"])
@router.post("/chat", response_model=ChatResponse)
async def chat(request: R2ChatRequest | ChatRequest):
    record = runtime.begin(request.request_id, request.session_id)
    started = time.monotonic()
    runtime.emit(request.request_id, "request", "started")
    try:
        if request.mode == "content_generation" and not isinstance(request, R2ChatRequest):
            raise DomainError("VALIDATION_ERROR", "内容生成须提供 message_id 和 generation 参数", 422, request.request_id)
        if isinstance(request, R2ChatRequest):
            runtime.configure_generation(request.request_id,request.message_id,request.campus_id,request.mode,getattr(request.generation,"type",None))
        if request.mode == "content_generation":
            runtime.emit(request.request_id,"generation","started")
        runtime.trace(request.request_id,action="route",stage="request",status="started",generation_type=getattr(getattr(request,"generation",None),"type",None))
        response = await model.generate(request)
        if record.cancel_requested:
            raise asyncio.CancelledError
        commit = getattr(model, "commit", None)
        if commit is not None:
            commit(request, response)
        runtime.finish(request.request_id, "completed", len(response.answer))
        runtime.emit(request.request_id, "request", "completed", duration_ms=(time.monotonic()-started)*1000)
        if request.mode == "content_generation":runtime.emit(request.request_id,"generation","completed",duration_ms=(time.monotonic()-started)*1000)
        return response
    except asyncio.CancelledError:
        runtime.finish(request.request_id, "cancelled")
        runtime.emit(request.request_id, "request", "cancelled", duration_ms=(time.monotonic()-started)*1000)
        if request.mode == "content_generation":runtime.emit(request.request_id,"generation","cancelled",{"code":"CANCELLED"})
        raise DomainError("CANCELLED", "本地请求已取消；上游停止状态须单独确认", 499, request.request_id)
    except Exception as error:
        runtime.finish(request.request_id, "failed")
        code = error.code if isinstance(error, DomainError) else "internal_error"
        runtime.emit(request.request_id, "request", "failed", {"code": code}, (time.monotonic()-started)*1000)
        if request.mode == "content_generation":runtime.emit(request.request_id,"generation","failed",{"code":code})
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
    if running:
        record.cancel_requested = True
        if record.task:
            record.task.cancel()
    return CancelResponse(request_id=request_id, status="cancel_requested" if running else "already_terminal",
        local_task_stopped=not running, upstream_stop=record.upstream_stop)
@router.post("/scene/ack", response_model=SceneAckResponse)
async def ack(body: SceneAck):
    return runtime.acknowledge(body)
@router.post("/runtime/client-events", response_model=RuntimeEvent)
async def client_events(body: ClientEventInput):
    return runtime.client_event(body)
