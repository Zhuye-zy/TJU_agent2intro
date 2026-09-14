"""C owns implementation after M0. Uses existing runtime/history/provider, not a second session system."""
from fastapi import APIRouter
from backend.common.errors import DomainError
from backend.r2_contracts import R2ChatRequest, GenerationRendered, RenderReceipt
router = APIRouter(prefix="/api", tags=["stream-generation"])
@router.post("/chat/stream", responses={200: {"content": {"text/event-stream": {}}}})
async def stream_chat(body: R2ChatRequest):
    raise DomainError("not_implemented", "R2 流式编排尚未实现", 501, body.request_id)
@router.post("/runtime/generation-rendered", response_model=RenderReceipt)
async def generation_rendered(body: GenerationRendered):
    raise DomainError("not_implemented", "生成渲染回执尚未实现", 501, body.request_id)
