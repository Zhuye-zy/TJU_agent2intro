import asyncio,json
from uuid import uuid4
import httpx
from fastapi.testclient import TestClient
from openai import AsyncOpenAI
from backend.app import app
from backend.common.config import Settings
from backend.model.service import CampusModelService,OpenAICompatibleProvider
import backend.model.runtime as runtime_module
import backend.model.stream_routes as stream_routes

class Chunks(httpx.AsyncByteStream):
 def __init__(self,chunks):self.chunks=chunks
 async def __aiter__(self):
  for chunk in self.chunks:yield chunk
def body(kind="social_post"):
 return {"request_id":str(uuid4()),"session_id":str(uuid4()),"message_id":str(uuid4()),"message":"写一段约150字迎新欢迎词","mode":"content_generation","campus_id":"weijinlu","selected_poi_id":None,
  "generation":{"type":kind,"requirements":"约150字","length":"short","style":"friendly"}}
def events(response):
 return [json.loads(line[6:]) for line in response.text.splitlines() if line.startswith("data: ")]
def install(monkeypatch,handler,total=120,idle=60):
 settings=Settings(llm_url="http://mock.local/mgate/v1/chat/completions",llm_model="glm-5.1",llm_api_key="test-only")
 client=httpx.AsyncClient(transport=httpx.MockTransport(handler))
 sdk=AsyncOpenAI(api_key="test-only",base_url=settings.sdk_base_url,http_client=client,max_retries=0)
 service=CampusModelService(settings,OpenAICompatibleProvider(settings,sdk,total,idle))
 store=runtime_module.RuntimeStore();monkeypatch.setattr(runtime_module,"runtime",store);monkeypatch.setattr(stream_routes,"runtime",store);monkeypatch.setattr(stream_routes,"model",service)
 return store,client
def test_real_sse_parser_handles_arbitrary_utf8_chunks_reasoning_heartbeat_and_usage(monkeypatch):
 captured=[]
 payloads=[
  b": heartbeat\r\n\r\n",
  ('data: '+json.dumps({"id":"x","object":"chat.completion.chunk","created":1,"model":"glm-51-fp8","choices":[{"index":0,"delta":{"reasoning_content":"hidden"},"finish_reason":None}]})+'\n\n').encode(),
  ('data: '+json.dumps({"id":"x","object":"chat.completion.chunk","created":1,"model":"glm-51-fp8","choices":[{"index":0,"delta":{"content":"欢迎新同学"},"finish_reason":None}]},ensure_ascii=False)+'\r\n\r\n').encode(),
  ('data: '+json.dumps({"id":"x","object":"chat.completion.chunk","created":1,"model":"glm-51-fp8","choices":[{"index":0,"delta":{"content":"！"},"finish_reason":"stop"}]})+'\n\n'+'data: '+json.dumps({"id":"x","object":"chat.completion.chunk","created":1,"model":"glm-51-fp8","choices":[],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}})+'\n\n').encode(),
  b"data: [DONE]\n\n"]
 raw=b"".join(payloads);cuts=[1,2,5,11,19,31,47,83,len(raw)];chunks=[];last=0
 for cut in cuts:chunks.append(raw[last:cut]);last=cut
 def handler(request):
  captured.append(json.loads(request.content))
  return httpx.Response(200,headers={"content-type":"text/event-stream"},stream=Chunks(chunks))
 store,client=install(monkeypatch,handler)
 with TestClient(app) as api:r=api.post("/api/chat/stream",json=body())
 es=events(r);visible="".join(e["payload"]["text"] for e in es if e["type"]=="answer_delta")
 assert r.status_code==200 and visible=="【创作内容】欢迎新同学！" and "hidden" not in r.text
 assert captured[0]["stream"] is True and captured[0]["stream_options"]=={"include_usage":True}
 assert [e["seq"] for e in es]==list(range(1,len(es)+1))
 assert sum(e["type"] in ("completed","error","cancelled") for e in es)==1
 assert next(e for e in es if e["type"]=="usage")["payload"]["usage"]["total_tokens"]==5
 rid=next(iter(store.records));assert store.records[rid].terminal_count==1
 asyncio.run(client.aclose())
def test_reasoning_only_is_empty_and_length_is_incomplete(monkeypatch):
 for finish,code in [("stop","EMPTY_OUTPUT"),("length","INCOMPLETE_OUTPUT")]:
  delta={"reasoning_content":"secret"} if finish=="stop" else {"content":"半段"}
  raw=('data: '+json.dumps({"id":"x","object":"chat.completion.chunk","created":1,"model":"glm-51-fp8","choices":[{"index":0,"delta":delta,"finish_reason":finish}]})+'\n\ndata: [DONE]\n\n').encode()
  store,client=install(monkeypatch,lambda request,r=raw:httpx.Response(200,headers={"content-type":"text/event-stream"},stream=Chunks([r])))
  with TestClient(app) as api:r=api.post("/api/chat/stream",json=body())
  terminal=[e for e in events(r) if e["type"] in ("completed","error","cancelled")]
  assert terminal[0]["type"]=="error" and terminal[0]["payload"]["code"]==code
  assert "secret" not in r.text and next(iter(store.records.values())).terminal_count==1
  asyncio.run(client.aclose())
def test_old_generation_entry_is_explicit_validation_error():
 legacy={"request_id":str(uuid4()),"session_id":str(uuid4()),"message":"写欢迎词","mode":"content_generation","campus_id":"weijinlu","selected_building_id":None}
 with TestClient(app) as api:r=api.post("/api/chat",json=legacy)
 assert r.status_code==422 and r.json()["error"]["code"]=="VALIDATION_ERROR"
