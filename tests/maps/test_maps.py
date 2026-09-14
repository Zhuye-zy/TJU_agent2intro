import asyncio
from uuid import uuid4
import httpx
from fastapi.testclient import TestClient
from backend.app import app
from backend.common.config import Settings
from backend.r2_contracts import POI,GeoLocation,Entrance
from backend.maps.service import MapService
import backend.maps.service as service_module
import backend.maps.routes as routes
class Knowledge:
 def __init__(self,located=True):
  loc=GeoLocation(lng=117.17,lat=39.11,crs="GCJ02",coordinate_source="D fixture",verified_at="2026-09-14",quality="entrance") if located else None
  entrance=Entrance(id="main",name="正门",location=loc,source_refs=["source-1"],access_notes=None)
  self.poi=POI(id="library",campus_id="weijinlu",name="图书馆",aliases=[],category="library",description="",source_refs=["source-1"],location=None,schematic_position=None,entrances=[entrance],verification_status="verified")
 def get_poi(self,pid):return self.poi if pid=="library" else None
 def get_status(self):
  class Status: status="ready"
  return Status()
def configure(monkeypatch,settings,handler=None,located=True):
 client=httpx.AsyncClient(transport=httpx.MockTransport(handler)) if handler else httpx.AsyncClient()
 svc=MapService(settings,client);k=Knowledge(located)
 monkeypatch.setattr(service_module,"knowledge",k);monkeypatch.setattr(routes,"knowledge",k);monkeypatch.setattr(routes,"maps",svc);monkeypatch.setattr(routes,"settings",settings)
 return svc,client
def test_missing_keys_reports_not_configured_separately(monkeypatch):
 svc,client=configure(monkeypatch,Settings(amap_js_key="",amap_security_key="",amap_web_service_key=""))
 with TestClient(app) as api:
  status=api.get("/api/maps/status").json();proxy=api.get("/api/maps/amap/_AMapService/v3/place/text",params={"keywords":"图书馆"})
 assert status["online_map"]=="NOT_CONFIGURED" and status["in_app_routing"]=="NOT_CONFIGURED"
 assert proxy.status_code==503 and proxy.json()["error"]["code"]=="NOT_CONFIGURED"
 asyncio.run(client.aclose())
def test_proxy_is_fixed_allowlist_and_injects_server_credentials(monkeypatch):
 seen=[]
 def handler(request):seen.append(request);return httpx.Response(200,json={"status":"1"})
 svc,client=configure(monkeypatch,Settings(amap_js_key="public-js",amap_security_key="server-security"),handler)
 with TestClient(app) as api:
  ok=api.get("/api/maps/amap/_AMapService/v3/place/text",params={"keywords":"图书馆","page":"1"})
  bad=api.get("/api/maps/amap/_AMapService/http://internal",params={"url":"http://127.0.0.1"})
  injected=api.get("/api/maps/amap/_AMapService/v3/place/text",params={"keywords":"x","key":"attacker"})
 assert ok.status_code==200 and bad.status_code==404 and injected.status_code==422
 assert seen[0].url.host=="restapi.amap.com" and seen[0].url.params["key"]=="public-js" and seen[0].url.params["jscode"]=="server-security"
 asyncio.run(client.aclose())
def test_external_navigation_uses_verified_entrance_or_name_search(monkeypatch):
 svc,client=configure(monkeypatch,Settings(),located=True)
 coordinate=svc.external("library");assert coordinate.kind=="coordinate" and "coordinate=gaode" in coordinate.url
 svc2,client2=configure(monkeypatch,Settings(),located=False)
 search=svc2.external("library");assert search.kind=="search" and search.precision=="name_search" and "position=" not in search.url
 asyncio.run(client.aclose());asyncio.run(client2.aclose())
def test_walking_uses_provider_distance_and_deduplicates_route_id(monkeypatch):
 def handler(request):
  assert request.url.path=="/v3/direction/walking"
  return httpx.Response(200,json={"status":"1","route":{"paths":[{"distance":"321","duration":"250","steps":[{"instruction":"向东步行","distance":"100","polyline":"117.1,39.1;117.2,39.2"}]}]}})
 svc,client=configure(monkeypatch,Settings(amap_web_service_key="server-web"),handler)
 rid=uuid4();payload={"route_id":str(rid),"session_id":str(uuid4()),"campus_id":"weijinlu","destination_poi_id":"library","entrance_id":"main","origin":{"lng":117.1,"lat":39.1,"crs":"GCJ02","source":"amap_geolocation","accuracy_m":10,"timestamp":"2026-09-14T00:00:00Z"},"user_initiated":True}
 with TestClient(app) as api:first=api.post("/api/maps/routes",json=payload);second=api.post("/api/maps/routes",json=payload)
 assert first.status_code==200 and first.json()["distance_m"]==321 and first.json()["campus_access"]=="unverified"
 assert second.status_code==409 and second.json()["error"]["code"]=="VALIDATION_ERROR"
 asyncio.run(client.aclose())
