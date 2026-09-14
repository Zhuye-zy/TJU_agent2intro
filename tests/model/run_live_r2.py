"""Manual live verification. Requires explicit backend env; never prints prompts, answers or secrets."""
import json,statistics,time
from uuid import uuid4
import httpx
BASE="http://127.0.0.1:8013"
def base(message,mode="general_chat",campus="weijinlu",selected=None,generation=None,session=None):
 return {"request_id":str(uuid4()),"session_id":str(session or uuid4()),"message_id":str(uuid4()),"message":message,"mode":mode,"campus_id":campus,"selected_poi_id":selected,"generation":generation}
def nonstream():
 payload={k:v for k,v in base("请用两句话说明你能提供哪些校园导览帮助").items() if k not in ("message_id","selected_poi_id","generation")}
 started=time.monotonic();r=httpx.post(BASE+"/api/chat",json=payload,timeout=130);elapsed=(time.monotonic()-started)*1000
 data=r.json();return {"request_id":payload["request_id"],"ok":r.status_code==200,"elapsed_ms":round(elapsed,1),"model":data.get("model"),"chars":len(data.get("answer","")),"error":data.get("error",{}).get("code")}
def stream(payload):
 started=time.monotonic();first_event=None;first_text=None;end=None;model=None;chars=0;ctype=None
 with httpx.stream("POST",BASE+"/api/chat/stream",json=payload,timeout=130) as r:
  ctype=r.headers.get("content-type");buf=[]
  for line in r.iter_lines():
   if line.startswith("data: "):
    e=json.loads(line[6:]);now=time.monotonic()
    if first_event is None:first_event=(now-started)*1000
    if e["type"]=="answer_delta":
     chars+=len(e["payload"]["text"])
     if first_text is None:first_text=(now-started)*1000
    if e["type"]=="usage":model=e["payload"]["model"]
    if e["type"] in ("completed","error","cancelled"):end=e["type"];error=e["payload"].get("code")
 elapsed=(time.monotonic()-started)*1000
 return {"request_id":payload["request_id"],"ok":end=="completed","content_type":ctype.split(";")[0] if ctype else None,"first_event_ms":round(first_event,1) if first_event else None,"first_text_ms":round(first_text,1) if first_text else None,"elapsed_ms":round(elapsed,1),"model":model,"chars":chars,"terminal":end,"error":locals().get("error")}
def summary(rows,key):
 vals=[r[key] for r in rows if r["ok"] and r[key] is not None]
 return {"n":len(rows),"success":len(vals),"median_ms":round(statistics.median(vals),1) if vals else None,"range_ms":[min(vals),max(vals)] if vals else None,"failures":[r["error"] for r in rows if not r["ok"]]}
if __name__=="__main__":
 non=[nonstream() for _ in range(3)]
 streamed=[stream(base("请用两句话说明你能提供哪些校园导览帮助")) for _ in range(3)]
 tasks=[
  base("写一段约150字迎新欢迎词","content_generation","weijinlu",generation={"type":"social_post","requirements":"约150字","length":"short","style":"friendly"}),
  base("介绍这里，写成新生可听懂的讲解稿","content_generation","beiyangyuan","beiyangyuan-zhengdong-library",{"type":"guide_script","requirements":"只使用检索事实","length":"medium","style":"friendly"}),
  base("依据真实已知点位编排游览建议","content_generation","beiyangyuan",generation={"type":"visit_plan","requirements":"不编造时间、开放状态或步行距离","length":"medium","style":"formal"})]
 generated=[stream(x) for x in tasks]
 print(json.dumps({"nonstream_runs":non,"stream_runs":streamed,"generation_runs":generated,"nonstream_summary":summary(non,"elapsed_ms"),"stream_first_text_summary":summary(streamed,"first_text_ms"),"stream_complete_summary":summary(streamed,"elapsed_ms")},ensure_ascii=False))
