"""Restricted AMap adapter. It never logs precise coordinates or accepts an upstream URL."""
import asyncio,time,json,os
from pathlib import Path
from collections import OrderedDict,deque
from urllib.parse import urlencode
from uuid import UUID
import httpx
from backend.common.errors import DomainError
from backend.r2_contracts import ExternalNavigation, RouteResponse, RouteStep
from backend.knowledge.service import knowledge

_PROXY={
 "v4/map/styles":("https://webapi.amap.com/v4/map/styles",{"styleid"}),
 "v3/geocode/regeo":("https://restapi.amap.com/v3/geocode/regeo",{"location","extensions","radius","roadlevel"}),
 "v3/geocode/geo":("https://restapi.amap.com/v3/geocode/geo",{"address","city"}),
 "v3/place/text":("https://restapi.amap.com/v3/place/text",{"keywords","types","city","citylimit","children","offset","page","extensions"}),
 "v3/place/around":("https://restapi.amap.com/v3/place/around",{"location","keywords","types","city","radius","sortrule","offset","page","extensions"}),
}
def _poi(pid):
 getter=getattr(knowledge,"get_poi",None)
 if getter:
  try:return getter(pid)
  except Exception:return None
 b=knowledge.get_building(pid)
 return b
def _location(poi,entrance_id=None):
 entrances=getattr(poi,"entrances",[]) or []
 if entrance_id:
  match=next((e for e in entrances if e.id==entrance_id),None)
  if not match:raise DomainError("VALIDATION_ERROR","指定入口不存在",422)
  return match.location,match
 verified=[e for e in entrances if e.location and e.location.quality=="entrance"]
 if verified:return verified[0].location,verified[0]
 loc=getattr(poi,"location",None)
 return (loc,None) if loc and loc.quality=="entrance" else (None,None)
class MapService:
 def __init__(self,settings,client=None):
  self.settings=settings;self.client=client or httpx.AsyncClient(timeout=12,follow_redirects=False)
  self.online_state="UNVERIFIED" if settings.amap_js_key and settings.amap_security_key.get_secret_value() else "NOT_CONFIGURED"
  self.route_state="UNVERIFIED" if settings.amap_web_service_key.get_secret_value() else "NOT_CONFIGURED"
  self.records:OrderedDict[UUID,dict]=OrderedDict();self.session_running={};self.recent=deque();self.traces=deque(maxlen=2000);self.semaphore=asyncio.Semaphore(2)
 def trace(self,action,status,request_id=None,elapsed_ms=None,code=None):
  entry={"request_id":str(request_id) if request_id else None,"action":action,"status":status,"monotonic_ms":round(time.monotonic()*1000,3),"elapsed_ms":elapsed_ms,"code":code};self.traces.append(entry)
  if "PYTEST_CURRENT_TEST" not in os.environ:
   path=Path(".runtime/map-r2.jsonl");path.parent.mkdir(exist_ok=True)
   with path.open("a",encoding="utf-8") as output:output.write(json.dumps(entry,ensure_ascii=False,separators=(",",":"))+"\n")
 async def proxy(self,path,params):
  if path not in _PROXY:raise DomainError("VALIDATION_ERROR","该高德路径不在允许列表",404)
  js=self.settings.amap_js_key;security=self.settings.amap_security_key.get_secret_value()
  if not js or not security:raise DomainError("NOT_CONFIGURED","在线地图安全代理尚未配置",503)
  url,allowed=_PROXY[path]
  if any(k not in allowed for k in params):raise DomainError("VALIDATION_ERROR","查询参数不在允许列表",422)
  clean={k:v for k,v in params.items() if k in allowed};clean.update({"key":js,"jscode":security})
  started=time.monotonic();self.trace("map_proxy","started")
  try:
   response=await self.client.get(url,params=clean);response.raise_for_status()
  except httpx.TimeoutException:self.online_state="FAILED";self.trace("map_proxy","failed",elapsed_ms=(time.monotonic()-started)*1000,code="UPSTREAM_TIMEOUT");raise DomainError("UPSTREAM_TIMEOUT","高德服务请求超时",503,retryable=True) from None
  except httpx.HTTPError:self.online_state="FAILED";self.trace("map_proxy","failed",elapsed_ms=(time.monotonic()-started)*1000,code="NETWORK_ERROR");raise DomainError("NETWORK_ERROR","高德服务暂时不可用",503,retryable=True) from None
  if len(response.content)>2_000_000:raise DomainError("UPSTREAM_PROTOCOL_ERROR","高德响应超过安全上限",503)
  self.online_state="VERIFIED";self.trace("map_proxy","completed",elapsed_ms=(time.monotonic()-started)*1000);return response
 def external(self,pid):
  poi=_poi(pid)
  if poi is None:raise DomainError("VALIDATION_ERROR","点位不存在",404)
  loc,_=_location(poi)
  name=getattr(poi,"name",None) or getattr(poi,"title",pid)
  if loc and loc.crs in ("GCJ02","WGS84"):
   coordinate="gaode" if loc.crs=="GCJ02" else "wgs84"
   url="https://uri.amap.com/marker?"+urlencode({"position":f"{loc.lng},{loc.lat}","name":name,"coordinate":coordinate,"src":"AI4TJU","callnative":"1"})
   return ExternalNavigation(poi_id=pid,url=url,kind="coordinate",precision="verified_destination")
  url="https://uri.amap.com/search?"+urlencode({"keyword":name,"src":"AI4TJU","callnative":"1"})
  return ExternalNavigation(poi_id=pid,url=url,kind="search",precision="name_search")
 def reserve(self,body):
  now=time.monotonic()
  while self.recent and now-self.recent[0][0]>60:self.recent.popleft()
  if body.route_id in self.records:raise DomainError("VALIDATION_ERROR","route_id 已存在，避免重复执行",409,body.route_id)
  if body.session_id in self.session_running:raise DomainError("RATE_LIMITED","同一会话已有路线请求",429,body.route_id,True)
  if sum(1 for _,s in self.recent if s==body.session_id)>=6 or len(self.recent)>=30:raise DomainError("RATE_LIMITED","路线请求过于频繁",429,body.route_id,True)
  self.recent.append((now,body.session_id));self.records[body.route_id]={"session":body.session_id,"status":"running","task":asyncio.current_task(),"upstream":"not_started"};self.session_running[body.session_id]=body.route_id
  while len(self.records)>1000:self.records.popitem(last=False)
 async def route(self,body):
  key=self.settings.amap_web_service_key.get_secret_value()
  if not key:raise DomainError("NOT_CONFIGURED","未配置高德 Web 服务；可使用外部导航",503,body.route_id)
  poi=_poi(body.destination_poi_id)
  if poi is None or getattr(poi,"campus_id",None)!=body.campus_id:raise DomainError("VALIDATION_ERROR","目的点不存在或不属于所选校区",422,body.route_id)
  loc,entrance=_location(poi,body.entrance_id)
  if not loc:raise DomainError("VALIDATION_ERROR","该点位没有经验证的入口坐标，可使用名称外部导航",422,body.route_id)
  if loc.crs!="GCJ02":raise DomainError("VALIDATION_ERROR","步行规划要求起终点均为 GCJ02，当前入口坐标系不一致",422,body.route_id)
  self.reserve(body);rec=self.records[body.route_id];started=time.monotonic();self.trace("walking_route","started",body.route_id)
  try:
   async with self.semaphore:
    rec["task"]=asyncio.current_task();rec["upstream"]="unconfirmed"
    response=await self.client.get("https://restapi.amap.com/v3/direction/walking",params={"key":key,"origin":f"{body.origin.lng},{body.origin.lat}","destination":f"{loc.lng},{loc.lat}","output":"JSON"})
    response.raise_for_status();data=response.json()
   if str(data.get("status"))!="1":raise DomainError("UPSTREAM_PROTOCOL_ERROR","高德未返回可用步行路线",503,body.route_id)
   paths=data.get("route",{}).get("paths",[])
   if not paths:raise DomainError("UPSTREAM_PROTOCOL_ERROR","高德未返回可用步行路线",503,body.route_id)
   path=paths[0];steps=[]
   for s in path.get("steps",[]):
    poly=[]
    for pair in (s.get("polyline") or "").split(";"):
     try:x,y=pair.split(",");poly.append((float(x),float(y)))
     except ValueError:continue
    steps.append(RouteStep(instruction=s.get("instruction") or "继续步行",distance_m=float(s.get("distance") or 0),polyline=poly))
   rec["status"]="completed";self.route_state="VERIFIED";self.trace("walking_route","completed",body.route_id,(time.monotonic()-started)*1000)
   refs=list(getattr(entrance,"source_refs",[]) or [])
   return RouteResponse(route_id=body.route_id,destination_poi_id=body.destination_poi_id,provider="amap",crs="GCJ02",distance_m=float(path.get("distance") or 0),duration_s=float(path["duration"]) if path.get("duration") is not None else None,steps=steps,campus_access="unverified",access_source_refs=refs)
  except asyncio.CancelledError:rec["status"]="cancelled";self.trace("walking_route","cancelled",body.route_id,(time.monotonic()-started)*1000,"CANCELLED");raise DomainError("CANCELLED","本地路线请求已取消；上游停止状态未确认",499,body.route_id) from None
  except DomainError as e:rec["status"]="failed";self.route_state="FAILED";self.trace("walking_route","failed",body.route_id,(time.monotonic()-started)*1000,e.code);raise
  except httpx.TimeoutException:rec["status"]="failed";self.route_state="FAILED";self.trace("walking_route","failed",body.route_id,(time.monotonic()-started)*1000,"UPSTREAM_TIMEOUT");raise DomainError("UPSTREAM_TIMEOUT","高德路线请求超时",503,body.route_id,True) from None
  except Exception:rec["status"]="failed";self.route_state="FAILED";self.trace("walking_route","failed",body.route_id,(time.monotonic()-started)*1000,"UPSTREAM_PROTOCOL_ERROR");raise DomainError("UPSTREAM_PROTOCOL_ERROR","高德路线响应无效",503,body.route_id) from None
  finally:self.session_running.pop(body.session_id,None);rec["task"]=None
 def cancel(self,rid,sid):
  rec=self.records.get(rid)
  if not rec or rec["session"]!=sid:raise DomainError("VALIDATION_ERROR","路线请求不存在或会话不匹配",404,rid)
  running=rec["status"]=="running"
  if running and rec["task"]:rec["task"].cancel()
  return running,rec["upstream"]
