"""R2 POST/SSE endpoint over the shared provider, workflow, history and runtime."""
import asyncio, json, time
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import TypeAdapter
from backend.common.errors import DomainError
from backend.contracts import ChatResponse
from backend.r2_contracts import R2ChatRequest, GenerationRendered, RenderReceipt, StreamEvent
from .service import model, _citations
from .runtime import runtime
router=APIRouter(prefix="/api",tags=["stream-generation"])
_event_adapter=TypeAdapter(StreamEvent)

def _sse(request_id,seq,event_type,payload):
 event=_event_adapter.validate_python({"event_id":uuid4(),"request_id":request_id,"seq":seq,"type":event_type,
  "timestamp":datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),"payload":payload})
 raw=event.model_dump_json()
 return f"id: {event.event_id}\nevent: {event.type}\ndata: {raw}\n\n".encode()
def _reason(code):
 if code=="UPSTREAM_TIMEOUT":return "timeout"
 if code=="INCOMPLETE_OUTPUT":return "length"
 if code=="EMPTY_OUTPUT":return "empty"
 if code=="VALIDATION_ERROR":return "validation"
 return "upstream"

@router.post("/chat/stream",responses={200:{"content":{"text/event-stream":{}}}})
async def stream_chat(body:R2ChatRequest):
 record=runtime.begin(body.request_id,body.session_id)
 runtime.configure_generation(body.request_id,body.message_id,body.campus_id,body.mode,getattr(body.generation,"type",None))
 runtime.emit(body.request_id,"request","started")
 runtime.trace(body.request_id,action="route",stage="request",status="started",generation_type=getattr(body.generation,"type",None))
 record.task=None
 async def events():
  seq=0;started=time.monotonic();answer="";prepared=None;terminal=False
  def emit(kind,payload):
   nonlocal seq
   seq+=1
   return _sse(body.request_id,seq,kind,payload)
  try:
   runtime.attach_task(body.request_id)
   yield emit("accepted",{"session_id":body.session_id,"message_id":body.message_id,"campus_id":body.campus_id,"mode":body.mode})
   yield emit("status",{"stage":"request","status":"started"})
   if body.mode=="content_generation":
    runtime.emit(body.request_id,"generation","started")
    yield emit("status",{"stage":"generation","status":"started"})
   prepared=await model.prepare(body)
   if prepared.needs_selection:
    answer="请先选择具体点位，我才能确定“这里”指的是哪一处。"
   elif body.mode=="campus_qa" and not prepared.knowledge_ready:
    raise DomainError("UPSTREAM_PROTOCOL_ERROR","校园资料库尚不可用",503,body.request_id)
   elif body.mode=="campus_qa" and not prepared.hits:
    answer="当前检索没有找到足够资料，我不能在缺少事实依据时猜测。"
   else:
    if prepared.hits:yield emit("sources",{"sources":prepared.hits,"kind":"retrieved"})
    yield emit("status",{"stage":"model","status":"started"})
    prefix="【创作内容】" if body.mode=="content_generation" else ""
    async for item in model.provider.stream(body.request_id,prepared.messages()):
     if item["kind"]=="delta":
      text=prefix+item["text"];prefix="";answer+=text;yield emit("answer_delta",{"text":text})
     else:model_name=item["model"];usage=item["usage"]
   if not answer.strip():raise DomainError("EMPTY_OUTPUT","模型未返回可见正文",503,body.request_id)
   cited_answer,cited=_citations(answer,prepared.hits,body.mode=="campus_qa" or bool(prepared.hits),body.request_id)
   actions=model.actions(prepared);model_name=locals().get("model_name","local-workflow");usage=locals().get("usage",None)
   if cited:yield emit("sources",{"sources":cited,"kind":"cited"})
   for action in actions:yield emit("poi_action",{"action":action})
   yield emit("usage",{"model":model_name,"usage":usage})
   response=ChatResponse(request_id=body.request_id,session_id=body.session_id,answer=cited_answer,sources=cited,model=model_name,usage=usage,elapsed_ms=(time.monotonic()-started)*1000,actions=actions)
   model.commit(body,response)
   if runtime.finish(body.request_id,"completed",len(cited_answer)):
    terminal=True;runtime.emit(body.request_id,"generation" if body.mode=="content_generation" else "request","completed",duration_ms=response.elapsed_ms)
    yield emit("completed",{"response":response})
  except asyncio.CancelledError:
   if runtime.finish(body.request_id,"cancelled"):
    terminal=True;runtime.emit(body.request_id,"generation" if body.mode=="content_generation" else "request","cancelled",{"code":"CANCELLED"},(time.monotonic()-started)*1000)
    yield emit("cancelled",{"local_task_stopped":True,"upstream_stop":record.upstream_stop})
  except DomainError as error:
   if runtime.finish(body.request_id,"failed",len(answer)):
    terminal=True;runtime.emit(body.request_id,"generation" if body.mode=="content_generation" else "request","failed",{"code":error.code},(time.monotonic()-started)*1000)
    yield emit("error",{"code":error.code,"message":error.message,"retryable":error.retryable,"partial":bool(answer),"answer":answer,"reason":_reason(error.code)})
  except Exception:
   if runtime.finish(body.request_id,"failed",len(answer)):
    terminal=True;runtime.emit(body.request_id,"generation" if body.mode=="content_generation" else "request","failed",{"code":"UPSTREAM_PROTOCOL_ERROR"},(time.monotonic()-started)*1000)
    yield emit("error",{"code":"UPSTREAM_PROTOCOL_ERROR","message":"请求处理失败","retryable":False,"partial":bool(answer),"answer":answer,"reason":"upstream"})
  finally:
   record.task=None
   if not terminal and record.status=="running":runtime.finish(body.request_id,"cancelled",len(answer))
 return StreamingResponse(events(),media_type="text/event-stream",headers={"Cache-Control":"no-cache, no-transform","X-Accel-Buffering":"no","Connection":"keep-alive"})

@router.post("/runtime/generation-rendered",response_model=RenderReceipt)
async def generation_rendered(body:GenerationRendered):
 return runtime.generation_rendered(body)
