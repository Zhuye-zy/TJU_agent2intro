"""C owns the optional online adapter. M0 never treats missing keys as a global failure."""
from fastapi import APIRouter
from backend.common.config import get_settings
from backend.common.errors import DomainError
from backend.r2_contracts import MapStatus, MapPublicConfig, ExternalNavigation
router = APIRouter(prefix="/api/maps", tags=["maps"])
@router.get("/status", response_model=MapStatus)
def status():
    cfg=get_settings()
    js=bool(cfg.amap_js_key); security=bool(cfg.amap_security_key.get_secret_value()); web=bool(cfg.amap_web_service_key.get_secret_value())
    return MapStatus(local_map="not_implemented", external_navigation="not_implemented",
        online_map="NOT_IMPLEMENTED" if js and security else "NOT_CONFIGURED",
        js_key_configured=js,security_key_configured=security,web_service_key_configured=web,
        precise_location="not_implemented",in_app_routing="not_implemented")
@router.get("/config", response_model=MapPublicConfig)
def public_config():
    return MapPublicConfig(js_key=get_settings().amap_js_key or None,service_host="/api/maps/amap/_AMapService",status=status())
@router.get("/external-navigation/{poi_id}", response_model=ExternalNavigation)
def external_navigation(poi_id: str):
    raise DomainError("not_implemented", "外部导航尚未实现", 501)
@router.get("/amap/_AMapService/{path:path}")
async def proxy(path: str):
    raise DomainError("not_implemented", "高德安全代理尚未实现", 501)

from uuid import UUID
from backend.r2_contracts import RouteRequest, RouteResponse, RouteCancelRequest, RouteCancelResponse
@router.post("/routes", response_model=RouteResponse)
async def plan_route(body: RouteRequest):
    if not get_settings().amap_web_service_key.get_secret_value():
        raise DomainError("map_not_configured", "未配置高德 Web 服务；可使用外部导航", 503, body.route_id)
    raise DomainError("not_implemented", "按需路线规划尚未实现", 501, body.route_id)
@router.post("/routes/{route_id}/cancel", response_model=RouteCancelResponse)
async def cancel_route(route_id: UUID, body: RouteCancelRequest):
    raise DomainError("not_implemented", "路线取消尚未实现", 501, route_id)
