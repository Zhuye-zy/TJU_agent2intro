"""M owns public application assembly. No model key or automatic upstream probe on boot."""
import os
os.environ["LANGSMITH_TRACING"] = "false"
os.environ["LANGCHAIN_TRACING_V2"] = "false"
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware
from backend.common.config import get_settings
from backend.common.errors import DomainError
from backend.contracts import ApiError, ErrorDetail, Health, CONTRACT_VERSION
from backend.model.routes import router as model_router
from backend.speech.routes import router as speech_router
from backend.knowledge.routes import router as knowledge_router
settings = get_settings()
app = FastAPI(title="AI4TJU campus guide", version=CONTRACT_VERSION,
    responses={status: {"model": ApiError} for status in (400,404,409,413,422,429,499,500,501,503)})
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["127.0.0.1", "localhost", "testserver"])
def error_response(code, message, status, request_id=None, retryable=False):
    return JSONResponse(status_code=status, content=ApiError(error=ErrorDetail(
        code=code, message=message, request_id=request_id, retryable=retryable)).model_dump(mode="json"))
@app.middleware("http")
async def body_limit(request: Request, call_next):
    size = 0
    chunks = []
    async for chunk in request.stream():
        size += len(chunk)
        if size > (2097152 if request.url.path == "/api/speech/asr" else 65536):
            return error_response("payload_too_large", "请求体超过该端点的大小上限", 413)
        chunks.append(chunk)
    request._body = b"".join(chunks)
    return await call_next(request)
@app.exception_handler(DomainError)
async def domain_error(request, error):
    return error_response(error.code, error.message, error.status, error.request_id, error.retryable)
@app.exception_handler(RequestValidationError)
async def validation_error(request, error):
    # Never echo input, headers, prompt or secret in validation errors.
    return error_response("invalid_request", "请求字段、类型或长度不符合契约", 422)
@app.exception_handler(HTTPException)
async def http_error(request, error):
    return error_response("http_error", "端点不存在或请求方法不支持", error.status_code)
@app.exception_handler(Exception)
async def internal_error(request, error):
    return error_response("internal_error", "服务内部错误", 500)
@app.get("/api/health", response_model=Health)
def health():
    return Health(status="ok", contract_version=CONTRACT_VERSION,
        model={"configured": bool(settings.llm_api_key.get_secret_value()), "verified": False},
        capabilities={"chat": False, "asr": False, "tts": False, "knowledge": False, "scene_3d": False})
app.include_router(model_router)
app.include_router(speech_router)
app.include_router(knowledge_router)
