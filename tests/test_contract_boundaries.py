import asyncio
from uuid import uuid4
from fastapi.testclient import TestClient
from backend.app import app
from backend.model.runtime import RuntimeStore
from backend.contracts import SceneAction, SceneAck, Building
import backend.model.runtime as runtime_module
client=TestClient(app)
def payload():
    return dict(request_id=str(uuid4()),session_id=str(uuid4()),message="你好",mode="campus_qa",campus_id="weijinlu",selected_building_id=None)
def test_stub_events_redaction_and_duplicate():
    body=payload(); body["message"]="private_marker_not_for_logs"
    response=client.post("/api/chat",json=body)
    assert response.status_code==501
    assert response.json()["error"]["code"]=="not_implemented"
    page=client.get("/api/runtime/events",params={"request_id":body["request_id"]}).json()
    assert [e["status"] for e in page["events"]]==["started","failed"]
    assert "private_marker" not in str(page)
    assert all(e["origin"]=="backend" for e in page["events"])
    assert client.post("/api/chat",json=body).status_code==409
    assert client.post(f'/api/requests/{body["request_id"]}/cancel',json={"session_id":body["session_id"]}).json()["upstream_stop"]=="not_started"
    assert client.post(f'/api/requests/{body["request_id"]}/cancel',json={"session_id":str(uuid4())}).status_code==409
def test_building_forged_ack_and_frontend_provenance():
    body=payload(); body["selected_building_id"]="fake-building"
    assert client.post("/api/chat",json=body).status_code==422
    ack={k:body[k] for k in ("request_id","session_id")}; ack.update(action_id=str(uuid4()),status="completed")
    assert client.post("/api/scene/ack",json=ack).status_code==404
    event={k:body[k] for k in ("request_id","session_id")}
    event.update(event_id=str(uuid4()),stage="model",status="completed",duration_ms=1,data={})
    assert client.post("/api/runtime/client-events",json=event).status_code==422
    event["stage"]="avatar"
    first=client.post("/api/runtime/client-events",json=event)
    assert first.status_code==200 and first.json()["origin"]=="frontend"
    assert client.post("/api/runtime/client-events",json=event).json()["seq"]==first.json()["seq"]
    event["status"]="failed"
    assert client.post("/api/runtime/client-events",json=event).status_code==409
def test_limits_and_empty_knowledge():
    body=payload(); body["history"]=[{"role":"system","content":"secret_marker"}]
    response=client.post("/api/chat",json=body)
    assert response.status_code==422 and "secret_marker" not in response.text
    assert client.post("/api/chat",content="x"*65537).status_code==413
    assert client.get("/api/knowledge/status").json()==dict(status="unavailable",version=None,document_count=0,building_count=0,updated_at=None)
    assert client.get("/api/knowledge/buildings",params={"campus_id":"weijinlu"}).json()=={"buildings":[]}
    assert client.get("/api/knowledge/search",params={"campus_id":"weijinlu","query":"图书馆"}).json()["hits"]==[]
    assert client.get("/api/knowledge/buildings/unknown").status_code==404
    assert client.get("/api/health").json()["model"]["verified"] is False
def test_published_ack_and_bounded_events(monkeypatch):
    # Fictional building exists only in this isolated test.
    class FixtureKnowledge:
        def get_building(self,id):
            return Building(id=id,title="fixture",campus_id="weijinlu",summary="",url="https://example.invalid",published_at=None,retrieved_at="2026-09-14",coordinates=None)
    monkeypatch.setattr(runtime_module,"knowledge",FixtureKnowledge())
    async def run():
        store=RuntimeStore(); req,ses,act=uuid4(),uuid4(),uuid4()
        store.begin(req,ses)
        store.publish(SceneAction(action_id=act,request_id=req,type="focus_building",parameters={"building_id":"fixture"}),ses,"weijinlu")
        assert len(store.events)==1 and store.events[0].status=="started"
        ack=SceneAck(request_id=req,session_id=ses,action_id=act,status="completed")
        assert store.acknowledge(ack).status=="recorded"
        assert store.acknowledge(ack).status=="duplicate"
        assert len(store.events)==2
        for _ in range(2100): store.emit(req,"request","started")
        assert len(store.events)==2000 and store.page(req,0).truncated
    asyncio.run(run())

def test_cancel_active_request_keeps_upstream_unconfirmed(monkeypatch):
    import threading
    from concurrent.futures import ThreadPoolExecutor
    import backend.model.routes as model_routes
    started=threading.Event()
    class WaitingModel:
        async def generate(self, request):
            model_routes.runtime.get(request.request_id).upstream_stop="unconfirmed"
            started.set()
            await asyncio.sleep(20)
    monkeypatch.setattr(model_routes,"model",WaitingModel())
    body=payload()
    with TestClient(app) as connected, ThreadPoolExecutor(max_workers=1) as pool:
        future=pool.submit(connected.post,"/api/chat",json=body)
        assert started.wait(3)
        result=connected.post(f'/api/requests/{body["request_id"]}/cancel',json={"session_id":body["session_id"]})
        assert result.status_code==200
        assert result.json()["status"]=="cancel_requested"
        assert result.json()["upstream_stop"]=="unconfirmed"
        assert future.result(timeout=3).status_code==499
        page=connected.get("/api/runtime/events",params={"request_id":body["request_id"]}).json()
        assert page["events"][-1]["status"]=="cancelled"
