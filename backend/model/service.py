"""C-owned model boundary. SDK and graph are real dependencies; M0 never calls upstream."""
from typing import Protocol, TypedDict
from openai import AsyncOpenAI
from langgraph.graph import StateGraph, START, END
from backend.contracts import ChatRequest, ChatResponse
from backend.common.config import Settings
from backend.common.errors import DomainError
class ModelAdapter(Protocol):
    async def generate(self, request: ChatRequest) -> ChatResponse: ...
class WorkflowState(TypedDict):
    status: str
def _stub(state: WorkflowState) -> WorkflowState:
    return {"status": "not_implemented"}
builder = StateGraph(WorkflowState)
builder.add_node("model_stub", _stub)
builder.add_edge(START, "model_stub")
builder.add_edge("model_stub", END)
workflow = builder.compile(checkpointer=False)
def create_client(settings: Settings) -> AsyncOpenAI:
    if not settings.llm_api_key.get_secret_value():
        raise DomainError("model_not_configured", "指定模型尚未配置密钥", 503)
    return AsyncOpenAI(api_key=settings.llm_api_key.get_secret_value(), base_url=settings.sdk_base_url, timeout=30.0, max_retries=0)
class UnimplementedModel:
    async def generate(self, request: ChatRequest) -> ChatResponse:
        await workflow.ainvoke({"status": "pending"})
        raise DomainError("not_implemented", "M0 模型接口已建立，真实对话由 C 实现", 501, request.request_id)
model: ModelAdapter = UnimplementedModel()
