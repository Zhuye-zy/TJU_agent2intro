import type { MapPublicConfig, POI, RouteRequest, RouteResponse, UserPosition } from '../../../shared/r2';
import { AmapNavigation, type AmapSdk } from '../transport/amap-navigation';
import { MapBudget } from '../transport/map-budget';

type AMapApi = AmapSdk & Record<string, new (...args: any[]) => any>;

export interface OnlineMapHandle {
  setPois(pois: POI[], selectedId: string | null): void;
  showPosition(position: UserPosition): void;
  showRoute(polyline: [number, number][][]): void;
  clearRoute(): void;
  resize(): void;
  locate(operationId: string, signal: AbortSignal): Promise<UserPosition>;
  walk(request: RouteRequest, poi: POI, signal: AbortSignal): Promise<RouteResponse>;
  destroy(): void;
}
// Pure classification remains testable; the M controller validates navigation origins.
export async function createOnlineMap(host: HTMLElement, config: MapPublicConfig, budget: MapBudget, operationId: string, signal: AbortSignal, onSelect: (poiId: string) => void): Promise<OnlineMapHandle> {
  let namespace: AMapApi | null = null;
  // This loader is invoked only inside M's reserved map_load budget operation.
  const navigation = new AmapNavigation(config, budget, async (settings) => {
    const service = new URL(settings.service_host, location.origin);
    if (service.origin !== location.origin) throw new Error('service_host_not_same_origin');
    (window as Window & {_AMapSecurityConfig?: {serviceHost:string}})._AMapSecurityConfig = {serviceHost:service.href.replace(/\/$/, '')};
    const loader = await import('@amap/amap-jsapi-loader');
    namespace = await loader.default.load({key:settings.js_key!,version:'2.0',plugins:['AMap.Geolocation','AMap.Walking','AMap.Scale']}) as AMapApi;
    return namespace;
  });
  const map = await navigation.createMap(host, operationId, signal, true, {viewMode:'2D'}) as any;
  const AMap = namespace! as AMapApi;
  if (AMap.Scale) map.addControl(new AMap.Scale());
  let markers:any[] = [], locationMarker:any = null, accuracyCircle:any = null, routeLines:any[] = [];
  function clearRoute() { if (routeLines.length) map.remove(routeLines); routeLines=[]; }
  function setPois(pois: POI[], selectedId: string | null) {
    if (markers.length) map.remove(markers);
    markers = pois.filter(poi => poi.location?.crs==='GCJ02' && poi.verification_status==='verified' && poi.location.verified_at && !['pending','approximate'].includes(poi.location.quality)).map(poi => {
      const marker = new AMap.Marker({position:[poi.location!.lng,poi.location!.lat],title:poi.name,zIndex:poi.id===selectedId?140:100});
      marker.on('click',()=>onSelect(poi.id)); return marker;
    });
    if (markers.length) {map.add(markers); map.setFitView(markers,false,[48,48,48,48],17);}
  }
  function showPosition(position:UserPosition) {
    const point=[position.lng,position.lat];
    if (!locationMarker) locationMarker=new AMap.Marker({position:point,title:position.source==='manual'?'手动起点':'授权定位',zIndex:200});
    else {locationMarker.setPosition(point);locationMarker.setTitle(position.source==='manual'?'手动起点':'授权定位');}
    map.add(locationMarker);
    if (accuracyCircle) {map.remove(accuracyCircle);accuracyCircle=null;}
    if (position.accuracy_m!==null) {
      accuracyCircle=new AMap.Circle({center:point,radius:position.accuracy_m,strokeColor:'#147da5',fillOpacity:.14});map.add(accuracyCircle);
    }
  }
  function showRoute(lines:[number,number][][]) {
    clearRoute();
    routeLines=lines.filter(line=>line.length>1).map(path=>new AMap.Polyline({path,strokeColor:'#08779d',strokeWeight:7,showDir:true}));
    if(routeLines.length){map.add(routeLines);map.setFitView(routeLines);}
  }
  return {setPois,showPosition,showRoute,clearRoute,resize(){map.resize?.();},locate:(id,abort)=>navigation.locate(id,abort,true),walk:(request,poi,abort)=>navigation.walk(request,poi,abort),destroy(){clearRoute();map.destroy();}};
}
