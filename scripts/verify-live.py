"""Read-only localhost smoke; intentionally sends one honest stub request."""
import json, time
from pathlib import Path
from uuid import uuid4
import httpx
root=Path(__file__).resolve().parents[1]
web="http://127.0.0.1:5173"
with httpx.Client(timeout=10,trust_env=False) as client:
    result={}
    for endpoint in ["/","/api/health","/api/knowledge/status","/assets/kelaita/runtime/kelaita.model3.json","/vendor/live2dcubismcore.min.js","/vendor/vad/silero_vad_v5.onnx"]:
        r=client.get(web+endpoint)
        r.raise_for_status()
        result[endpoint]={"http_status":r.status_code,"bytes":len(r.content)}
        if endpoint.startswith("/api/"): result[endpoint]["body"]=r.json()
    request_id,session_id=str(uuid4()),str(uuid4())
    body=dict(request_id=request_id,session_id=session_id,message="M0接口检查",mode="general_chat",campus_id="weijinlu",selected_building_id=None)
    r=client.post(web+"/api/chat",json=body)
    assert r.status_code==501 and r.json()["error"]["code"]=="not_implemented"
    result["chat"]={"http_status":r.status_code,"body":r.json()}
    events=client.get(web+"/api/runtime/events",params={"request_id":request_id,"cursor":0})
    events.raise_for_status()
    result["events"]=events.json()
    assert [e["status"] for e in result["events"]["events"]]==["started","failed"]
    stop=client.post(web+"/api/speech/stop",json={"request_id":request_id,"session_id":session_id})
    stop.raise_for_status()
    assert stop.json()["upstream_stop"]=="not_started"
    result["speech_stop"]=stop.json()
result["checked_at_unix"]=time.time()
(root/".runtime"/"live-smoke.json").write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("Local HTTP, Vite proxy, selected assets, explicit 501, real logs and speech stop: PASS")
print("Model configured:",result["/api/health"]["body"]["model"]["configured"],"verified: false")
