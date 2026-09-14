"""Explicit live acceptance probe. Sends benign test prompts to the running local backend.
No credentials are read here. Raw responses/audio/request IDs are never persisted.
"""
import argparse
import asyncio
import base64
import hashlib
import io
import json
import time
import wave
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
import httpx

async def main(base: str):
    report={"timestamp":datetime.now(timezone.utc).isoformat(),"base_url":base,"checks":{}}
    checks=report["checks"]
    async with httpx.AsyncClient(base_url=base,timeout=45) as client:
        checks["health_before"]=(await client.get("/api/health")).json()
        async def chat(label, message, session=None, mode="general_chat", building=None):
            request_id=str(uuid4())
            body=dict(request_id=request_id,session_id=session or str(uuid4()),message=message,
                mode=mode,campus_id="beiyangyuan" if building else "weijinlu",selected_building_id=building)
            start=time.perf_counter()
            task=asyncio.create_task(client.post("/api/chat",json=body))
            seen_started=False
            while not task.done():
                await asyncio.sleep(.15)
                page=await client.get("/api/runtime/events",params={"request_id":request_id,"cursor":0})
                if page.status_code==200 and not task.done():
                    seen_started |= any(e["stage"]=="request" and e["status"]=="started" for e in page.json()["events"])
            response=await task
            page=await client.get("/api/runtime/events",params={"request_id":request_id,"cursor":0})
            events=page.json().get("events",[])
            data=response.json()
            entry={"request_alias":label,"http_status":response.status_code,"wall_ms":round((time.perf_counter()-start)*1000),
                   "started_before_response":seen_started,"events":[{"origin":e["origin"],"stage":e["stage"],"status":e["status"],
                   "duration_ms":e["duration_ms"]} for e in events]}
            if response.status_code==200:
                entry.update(model=data["model"],elapsed_ms=round(data["elapsed_ms"],2),usage=data["usage"],
                    answer_nonempty=bool(data["answer"].strip()),sources=[{"id":s["id"],"title":s["title"],"url":s["url"]} for s in data["sources"]],
                    actions=[{"type":a["type"],"building_id":a["parameters"]["building_id"]} for a in data["actions"]])
            else: entry["error_code"]=data.get("error",{}).get("code")
            checks[label]=entry
            print(label,response.status_code,entry.get("model") or entry.get("error_code"),flush=True)
            return body,response,data
        session=str(uuid4()); marker="M1-"+uuid4().hex[:8]
        _,first,first_data=await chat("glm-first","请记住本轮标记 "+marker+"。请用一句话介绍你作为校园导游的名字和职责，不要重复标记。",session)
        if first.status_code==200:
            _,second,second_data=await chat("glm-followup","请只复述我上一条消息中的测试标记。",session)
            checks["glm-followup"]["marker_recalled"]=second.status_code==200 and marker in second_data.get("answer","")
        status=(await client.get("/api/knowledge/status")).json()
        search=(await client.get("/api/knowledge/search",params={"campus_id":"beiyangyuan","query":"郑东图书馆","limit":5})).json()
        buildings=(await client.get("/api/knowledge/buildings",params={"campus_id":"beiyangyuan"})).json()["buildings"]
        checks["knowledge"]={"status":status,"hit_ids":[h["id"] for h in search["hits"]],"building_ids":[b["id"] for b in buildings]}
        if first.status_code==200:
            body,response,data=await chat("campus-building","请介绍这里并显示建筑卡片，用一两句话回答并引用资料。",mode="campus_qa",building="beiyangyuan-zhengdong-library")
            # Only verify published/forged ack boundaries here; browser alone can claim UI execution.
            forged={"request_id":body["request_id"],"session_id":body["session_id"],"action_id":str(uuid4()),"status":"completed"}
            checks["forged_ack_http"]=(await client.post("/api/scene/ack",json=forged)).status_code
            checks["duplicate_chat_http"]=(await client.post("/api/chat",json=body)).status_code
        _,_,unknown=await chat("unknown-knowledge","zzzxqvnonexistent",mode="campus_qa")
        checks["unknown-knowledge"]["no_sources"]=unknown.get("sources")==[]
        if first.status_code==200:
            cancel_body=dict(request_id=str(uuid4()),session_id=str(uuid4()),message="请写一篇较长的虚构校园游览故事，并明确是创作。",
                mode="content_generation",campus_id="weijinlu",selected_building_id=None)
            task=asyncio.create_task(client.post("/api/chat",json=cancel_body))
            model_started=False
            for _ in range(50):
                await asyncio.sleep(.05)
                page=await client.get("/api/runtime/events",params={"request_id":cancel_body["request_id"]})
                if page.status_code==200:
                    model_started=any(e["stage"]=="model" and e["status"]=="started" for e in page.json()["events"])
                if model_started or task.done(): break
            result=await client.post("/api/requests/"+cancel_body["request_id"]+"/cancel",json={"session_id":cancel_body["session_id"]})
            response=await task
            page=(await client.get("/api/runtime/events",params={"request_id":cancel_body["request_id"]})).json()
            checks["cancel"]={"http_status":response.status_code,"model_started":model_started,
                "response":{k:v for k,v in result.json().items() if k!="request_id"},
                "terminal_status":page.get("events",[{}])[-1].get("status")}
        voices=(await client.get("/api/speech/voices")).json().get("voices",[])
        checks["voices"]={"count":len(voices),"ids":[v["id"] for v in voices]}
        if voices:
            voice=next((v for v in voices if v["id"]=="edge:zh-CN-XiaoxiaoNeural"),voices[0])
            tts_body=dict(request_id=str(uuid4()),session_id=str(uuid4()),utterance_id=str(uuid4()),
                text="猫眼石，欢迎来到天津大学。我是珂莱塔，陪你一起认识校园。",voice_id=voice["id"])
            started=time.perf_counter()
            result=await client.post("/api/speech/tts",json=tts_body)
            checks["tts"]={"http_status":result.status_code,"voice_id":voice["id"],"elapsed_ms":round((time.perf_counter()-started)*1000)}
            if result.status_code==200:
                audio=await client.get(result.json()["audio_url"])
                checks["tts"].update(audio_http=audio.status_code,bytes=len(audio.content),mime_type=audio.headers.get("content-type"),
                    sha256=hashlib.sha256(audio.content).hexdigest(),timestamps=result.json()["timestamps"],
                    second_fetch_http=(await client.get(result.json()["audio_url"])).status_code)
            else: checks["tts"]["error_code"]=result.json().get("error",{}).get("code")
        wav=io.BytesIO()
        with wave.open(wav,"wb") as file:
            file.setnchannels(1); file.setsampwidth(2); file.setframerate(16000); file.writeframes(bytes(3200))
        # Generated silence checks missing-service handling, not actual speech recognition.
        asr_body=dict(request_id=str(uuid4()),session_id=str(uuid4()),audio=dict(encoding="base64",mime_type="audio/wav",
            sample_rate_hz=16000,channels=1,audio_base64=base64.b64encode(wav.getvalue()).decode()))
        result=await client.post("/api/speech/asr",json=asr_body)
        checks["asr_configuration"]={"http_status":result.status_code,"error_code":result.json().get("error",{}).get("code"),
            "real_chinese_recognition":"NOT_TESTED"}
        checks["health_after"]=(await client.get("/api/health")).json()
    destination=Path(__file__).resolve().parents[1]/"docs/evidence/live-api.json"
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Sanitized evidence:",destination,flush=True)
if __name__=="__main__":
    parser=argparse.ArgumentParser(); parser.add_argument("--base",default="http://127.0.0.1:8000")
    asyncio.run(main(parser.parse_args().base))
