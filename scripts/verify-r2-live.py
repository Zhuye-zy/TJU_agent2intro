"""Explicit, bounded live model QA. No map calls, credentials, prompts or full answers saved."""
import argparse, asyncio, hashlib, json, platform, subprocess, time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
import httpx

ROOT=Path(__file__).resolve().parents[1]
def payload(message,mode="general_chat",campus="weijinlu",selected=None,generation=None,session=None):
    return dict(request_id=str(uuid4()),session_id=session or str(uuid4()),message_id=str(uuid4()),message=message,mode=mode,campus_id=campus,selected_poi_id=selected,generation=generation)
async def run_case(client,base,label,body,stream=False):
    start=time.perf_counter(); result={"case":label,"request_id":body["request_id"],"mode":body["mode"],"campus_id":body["campus_id"],"transport":"SSE" if stream else "POST","started_while_pending":False}
    finished=asyncio.Event()
    async def observe():
        while not finished.is_set():
            try:
                page=(await client.get(base+"/api/runtime/events",params={"request_id":body["request_id"]})).json()
                if not finished.is_set() and any(e["status"]=="started" for e in page.get("events",[])):result["started_while_pending"]=True
            except (httpx.HTTPError,ValueError): pass
            try:await asyncio.wait_for(finished.wait(),.4)
            except asyncio.TimeoutError:pass
    watcher=asyncio.create_task(observe());response={}; answer=""; terminal=[];types=[]; first=None
    try:
        if stream:
            async with client.stream("POST",base+"/api/chat/stream",json=body) as r:
                result["http_status"]=r.status_code;result["content_type"]=r.headers.get("content-type","").split(";")[0]
                if r.status_code!=200:
                    raw=json.loads(await r.aread());result["error_code"]=raw.get("error",{}).get("code")
                else:
                    async for line in r.aiter_lines():
                        if not line.startswith("data: "):continue
                        e=json.loads(line[6:]);assert e["request_id"]==body["request_id"]
                        types.append(e["type"])
                        if e["type"]=="answer_delta":
                            answer+=e["payload"]["text"]
                            if first is None:first=round((time.perf_counter()-start)*1000,1)
                        if e["type"] in ("completed","error","cancelled"):
                            terminal.append(e["type"])
                            if e["type"]=="completed":response=e["payload"]["response"];answer=response["answer"]
                            else:result["error_code"]=e["payload"].get("code")
            result["terminal_types"]=terminal;result["first_body_ms"]=first;result["event_types"]=types
            result["ok"]=terminal==["completed"] and bool(answer.strip())
        else:
            r=await client.post(base+"/api/chat",json=body);result["http_status"]=r.status_code
            response=r.json();answer=response.get("answer","");result["ok"]=r.status_code==200 and bool(answer.strip())
            result["error_code"]=response.get("error",{}).get("code")
        result.update(model=response.get("model"),usage=response.get("usage"),answer_chars=len(answer),answer_sha256=hashlib.sha256(answer.encode()).hexdigest(),source_ids=[s["id"] for s in response.get("sources",[])],excerpt=answer[:160])
    except Exception as error:
        result.update(ok=False,error_code=type(error).__name__)
    finally:
        finished.set();await watcher;result["elapsed_ms"]=round((time.perf_counter()-start)*1000,1)
    page=(await client.get(base+"/api/runtime/events",params={"request_id":body["request_id"]})).json()
    result["runtime_events"]=[{k:e[k] for k in ("event_id","request_id","seq","origin","stage","status","duration_ms","data")} for e in page.get("events",[])]
    print(json.dumps({k:v for k,v in result.items() if k not in ("runtime_events","excerpt","event_types")},ensure_ascii=False),flush=True)
    return result,answer

async def main(args):
    cases=[];session=str(uuid4())
    async with httpx.AsyncClient(timeout=135) as client:
        before=(await client.get(args.base+"/api/health")).json()
        def generation(kind):return {"type":kind,"requirements":"仅使用已提供的校园资料；未知开放时间、距离和通行情况请明确未知。","length":"short","style":"friendly"}
        tasks=[
            ("social_post","请写一段约150字迎新欢迎词。","weijinlu",None),
            ("guide_script","请为这里写一段面向新生的讲解稿。","beiyangyuan","beiyangyuan-zhengdong-library"),
            ("visit_plan","根据已知校园点位写一份简短游览建议。","beiyangyuan",None)]
        for kind,message,campus,selected in tasks:
            result,_=await run_case(client,args.base,"generation_nonstream_"+kind,payload(message,"content_generation",campus,selected,generation(kind)));cases.append(result)
        for kind,message,campus,selected in tasks:
            result,_=await run_case(client,args.base,"generation_stream_"+kind,payload(message,"content_generation",campus,selected,generation(kind)),True);cases.append(result)
        result,_=await run_case(client,args.base,"chat_turn1",payload("本轮临时标记是北洋松风27，请记住，并用一句话确认。",session=session));cases.append(result)
        result,answer=await run_case(client,args.base,"chat_turn2",payload("上一轮的临时标记是什么？请只复述该标记。",session=session));result["history_marker_recalled"]="北洋松风27" in answer;cases.append(result)
        after=(await client.get(args.base+"/api/health")).json()
    out={"tested_at":datetime.now(timezone.utc).isoformat(),"commit":subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip(),"device":platform.platform(),"base_url":args.base,"model_calls_planned":8,"map_calls":0,"browser_qa":False,"audible_latency_ms":None,"health_before":before,"health_after":after,"cases":cases}
    dest=ROOT/args.output;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    return 0 if all(c.get("ok") for c in cases) and cases[-1].get("history_marker_recalled") else 1

if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--base",default="http://127.0.0.1:8000");parser.add_argument("--output",default="docs/R2/evidence/m1-live-model.json")
    args=parser.parse_args()
    if not args.base.startswith(("http://127.0.0.1:","http://localhost:")):parser.error("Only the local application backend is supported")
    raise SystemExit(asyncio.run(main(args)))
