"""M1 integration regressions. All substitutes are confined to this test process."""
import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
import httpx
from fastapi.testclient import TestClient
from openai import AsyncOpenAI
from backend.app import app
from backend.common.config import Settings
from backend.contracts import ChatResponse
import backend.model.routes as routes
import backend.model.runtime as runtime_module
from backend.model.service import CampusModelService, OpenAICompatibleProvider

def body():
    return dict(request_id=str(uuid4()), session_id=str(uuid4()), message="fixture",
                mode="general_chat",campus_id="weijinlu",selected_building_id=None)

def isolate(monkeypatch, model):
    store=runtime_module.RuntimeStore()
    monkeypatch.setattr(runtime_module,"runtime",store)
    monkeypatch.setattr(routes,"runtime",store)
    monkeypatch.setattr(routes,"model",model)

def test_cancel_even_if_adapter_suppresses_task_cancellation(monkeypatch):
    started=threading.Event()
    commits=[]
    class LateModel:
        async def generate(self, request):
            started.set()
            try:
                await asyncio.sleep(30)
            except asyncio.CancelledError:
                return ChatResponse(request_id=request.request_id,session_id=request.session_id,
                    answer="late fixture",sources=[],model="fixture",usage=None,elapsed_ms=1,actions=[])
        def commit(self, *args): commits.append(args)
    isolate(monkeypatch,LateModel())
    data=body()
    with TestClient(app) as client, ThreadPoolExecutor(max_workers=1) as pool:
        pending=pool.submit(client.post,"/api/chat",json=data)
        assert started.wait(3)
        result=client.post(f'/api/requests/{data["request_id"]}/cancel',json={"session_id":data["session_id"]})
        assert result.status_code==200
        assert pending.result(timeout=3).status_code==499
        assert commits==[]
        events=client.get("/api/runtime/events",params={"request_id":data["request_id"]}).json()["events"]
        assert events[-1]["status"]=="cancelled"
        assert not any(e["stage"]=="request" and e["status"]=="completed" for e in events)

def test_wrong_model_rejected_and_mock_does_not_verify_live_health(monkeypatch):
    settings=Settings(llm_api_key="isolated-test-placeholder")
    payload={"id":"fixture","object":"chat.completion","created":1,"model":"different-model",
             "choices":[{"index":0,"message":{"role":"assistant","content":"fixture"},"finish_reason":"stop"}]}
    async def handler(request): return httpx.Response(200,json=payload)
    http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler))
    sdk=AsyncOpenAI(api_key="isolated-test-placeholder",base_url="http://mock.local/v1",http_client=http_client)
    provider=OpenAICompatibleProvider(settings,client=sdk)
    isolate(monkeypatch,CampusModelService(settings,provider=provider))
    with TestClient(app) as client:
        before=client.get("/api/health").json()["model"]
        response=client.post("/api/chat",json=body())
        assert response.status_code==503
        assert response.json()["error"]["code"]=="model_mismatch"
        assert not provider.state.verified
        payload["model"]="glm-5.1"
        assert client.post("/api/chat",json=body()).status_code==200
        assert provider.state.verified
        assert client.get("/api/health").json()["model"]==before
    asyncio.run(http_client.aclose())
