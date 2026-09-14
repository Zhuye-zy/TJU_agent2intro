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


# M1-R2 C01/C02 regression: these providers are isolated fixtures, never live evidence.
def test_eof_timeout_disconnect_tools_missing_model_and_late_body_are_not_success(monkeypatch):
 cases=[
  (None,"glm-5.1",None,"eof","INCOMPLETE_OUTPUT","disconnect"),
  (None,"glm-5.1",None,"timeout","INCOMPLETE_OUTPUT","timeout"),
  (None,"glm-5.1",None,"disconnect","INCOMPLETE_OUTPUT","disconnect"),
  ("length","glm-5.1",None,"eof","INCOMPLETE_OUTPUT","length"),
  ("tool_calls","glm-5.1",[{"index":0,"id":"tool1","type":"function","function":{"name":"navigate","arguments":"{}"}}],"eof","UPSTREAM_PROTOCOL_ERROR","upstream"),
  ("stop",None,None,"eof","UPSTREAM_PROTOCOL_ERROR","upstream"),
 ]
 class Broken(Chunks):
  def __init__(self,chunks,end):super().__init__(chunks);self.end=end
  async def __aiter__(self):
   for item in self.chunks:yield item
   if self.end=="timeout":await asyncio.sleep(0.1)
   if self.end=="disconnect":raise httpx.ReadError("fixture disconnect")
 for finish,model,tools,end,code,reason in cases:
  delta={"content":"已收到正文"}
  if tools:delta["tool_calls"]=tools
  payload={"id":"x","object":"chat.completion.chunk","created":1,"choices":[{"index":0,"delta":delta,"finish_reason":finish}]}
  if model:payload["model"]=model
  raw=("data: "+json.dumps(payload)+"\n\n").encode()
  store,client=install(monkeypatch,lambda request,r=raw,e=end:httpx.Response(200,headers={"content-type":"text/event-stream"},stream=Broken([r],e)),idle=0.03)
  with TestClient(app) as api:response=api.post("/api/chat/stream",json=body())
  terminal=[e for e in events(response) if e["type"] in ("completed","error","cancelled")]
  assert len(terminal)==1 and terminal[0]["type"]=="error"
  assert terminal[0]["payload"]["code"]==code and terminal[0]["payload"]["reason"]==reason
  assert stream_routes.model.provider.state.verified is False
  if code=="INCOMPLETE_OUTPUT":assert terminal[0]["payload"]["partial"] and "已收到正文" in terminal[0]["payload"]["answer"]
  asyncio.run(client.aclose())

def test_delta_after_stop_is_rejected(monkeypatch):
 raw=b""
 for text,finish in [("first","stop"),("late",None)]:
  raw+=("data: "+json.dumps({"id":"x","object":"chat.completion.chunk","created":1,"model":"glm-5.1","choices":[{"index":0,"delta":{"content":text},"finish_reason":finish}]})+"\n\n").encode()
 store,client=install(monkeypatch,lambda request:httpx.Response(200,headers={"content-type":"text/event-stream"},stream=Chunks([raw])))
 with TestClient(app) as api:response=api.post("/api/chat/stream",json=body())
 es=events(response)
 assert es[-1]["type"]=="error" and "late" not in "".join(e["payload"]["text"] for e in es if e["type"]=="answer_delta")
 asyncio.run(client.aclose())

def test_nonstream_generation_all_types_shared_history_and_runtime(monkeypatch):
 import backend.model.routes as routes
 captured=[]
 def handler(request):
  payload=json.loads(request.content);captured.append(payload)
  assert payload["stream"] is False
  context=json.loads(payload["messages"][-1]["content"])["retrieved_context_untrusted"]
  citation=" [source:"+context[0]["id"]+"]" if context else ""
  return httpx.Response(200,json={"id":"test","object":"chat.completion","created":1,"model":"glm-5.1","choices":[{"index":0,"message":{"role":"assistant","content":"欢迎来到天津大学，这是创作欢迎词。"+citation},"finish_reason":"stop"}]})
 store,client=install(monkeypatch,handler)
 monkeypatch.setattr(routes,"runtime",store);monkeypatch.setattr(routes,"model",stream_routes.model)
 with TestClient(app) as api:
  for kind in ("social_post","guide_script","visit_plan"):
   request=body(kind);response=api.post("/api/chat",json=request)
   assert response.status_code==200 and response.json()["answer"].startswith("【创作内容】")
   rid=next(reversed(store.records));record=store.records[rid]
   assert record.mode=="content_generation" and record.generation_type==kind and record.terminal_count==1
   assert any(e.request_id==rid and e.stage=="generation" and e.status=="completed" for e in store.events)
   receipt={"event_id":str(uuid4()),"request_id":request["request_id"],"session_id":request["session_id"],"message_id":request["message_id"],"campus_id":request["campus_id"],"answer_chars":len(response.json()["answer"])}
   assert api.post("/api/runtime/generation-rendered",json=receipt).status_code==200
 assert len(captured)==3
 asyncio.run(client.aclose())

# C04: real local corpus retrieval tests; no network provider calls.
def test_generic_visit_plan_uses_multiple_real_entities_and_selected_entity_first(monkeypatch):
 from backend.r2_contracts import R2ChatRequest
 from backend.knowledge.service import knowledge
 import backend.model.service as services
 store=runtime_module.RuntimeStore()
 monkeypatch.setattr(runtime_module,"runtime",store)
 async def verify():
  service=CampusModelService()
  for campus in ("weijinlu","beiyangyuan"):
   request=R2ChatRequest.model_validate(dict(body("visit_plan"),campus_id=campus,message="根据已知校园点位写一份简短游览建议。"))
   store.begin(request.request_id,request.session_id)
   prepared=await service.prepare(request)
   assert 2<=len(prepared.hits)<=5 and len({h.id for h in prepared.hits})==len(prepared.hits)
   assert all(h.campus_id==campus and h.url and h.snippet for h in prepared.hits)
   entities=[p for p in knowledge.list_pois(campus,None,"",100,None).items if p.verification_status=="verified"]
   assert sum(any(p.name in h.title+" "+h.snippet for h in prepared.hits) for p in entities)>=2
   context=json.loads(services._user_payload(prepared))["retrieved_context_untrusted"]
   assert sum(len(h["snippet"]) for h in context)<=12000
   selected=next(p for p in entities if p.category=="culture")
   next_request=R2ChatRequest.model_validate(dict(body("visit_plan"),campus_id=campus,selected_poi_id=selected.id,message="以这里为起点给出游览建议。"))
   store.begin(next_request.request_id,next_request.session_id)
   selected_prepared=await service.prepare(next_request)
   assert selected.name in selected_prepared.hits[0].title+" "+selected_prepared.hits[0].snippet
 asyncio.run(verify())

def test_visit_plan_fallback_does_not_change_campus_qa(monkeypatch):
 from backend.r2_contracts import R2ChatRequest
 import backend.model.service as services
 from backend.knowledge.service import knowledge
 store=runtime_module.RuntimeStore();monkeypatch.setattr(runtime_module,"runtime",store)
 def forbidden(*args,**kwargs):raise AssertionError("campus_qa cannot use visit directory fallback")
 monkeypatch.setattr(knowledge,"list_pois",forbidden)
 async def verify():
  request=R2ChatRequest.model_validate(dict(body(),mode="campus_qa",generation=None,message="虚构红宝石教学楼在哪里"))
  store.begin(request.request_id,request.session_id)
  prepared=await CampusModelService().prepare(request)
  expected=knowledge.search(request.message,request.campus_id,5)
  assert [h.id for h in prepared.hits]==[h.id for h in expected]
 asyncio.run(verify())

def test_generation_prefix_counts_towards_limit_for_stream_and_nonstream(monkeypatch):
 import backend.model.routes as routes
 from backend.model.service import GENERATION_PREFIX
 for stream in (False,True):
  for over in (0,1):
   content="字"*(23000-len(GENERATION_PREFIX)+over)
   def handler(request):
    choice={"index":0,"finish_reason":"stop"}
    if stream:
     choice["delta"]={"content":content}
     raw=("data: "+json.dumps({"id":"x","object":"chat.completion.chunk","created":1,"model":"glm-5.1","choices":[choice]},ensure_ascii=False)+"\n\ndata: [DONE]\n\n").encode()
     return httpx.Response(200,headers={"content-type":"text/event-stream"},stream=Chunks([raw]))
    choice["message"]={"role":"assistant","content":content}
    return httpx.Response(200,json={"id":"x","object":"chat.completion","created":1,"model":"glm-5.1","choices":[choice]})
   store,client=install(monkeypatch,handler)
   monkeypatch.setattr(routes,"runtime",store);monkeypatch.setattr(routes,"model",stream_routes.model)
   with TestClient(app) as api:response=api.post("/api/chat/stream" if stream else "/api/chat",json=body("social_post"))
   if stream:
    ev=events(response);terminal=ev[-1]
    visible="".join(e["payload"]["text"] for e in ev if e["type"]=="answer_delta")
    assert len(visible)==23000
    if over:
     assert terminal["type"]=="error" and terminal["payload"]["code"]=="INCOMPLETE_OUTPUT"
     assert terminal["payload"]["reason"]=="length" and terminal["payload"]["partial"]
    else:assert terminal["type"]=="completed" and len(terminal["payload"]["response"]["answer"])==23000
   elif over:assert response.status_code==503 and response.json()["error"]["code"]=="INCOMPLETE_OUTPUT"
   else:assert response.status_code==200 and len(response.json()["answer"])==23000
   asyncio.run(client.aclose())
