import type { MapPublicConfig, POI, UserPosition } from '../../../shared/r2';

type AMapApi = Record<string, new (...args: any[]) => any> & { plugin(names: string[], callback: () => void): void };
export interface LocatedPosition { position: UserPosition; coarse: boolean; sourceLabel: string }
export interface OnlineMapHandle {
  setPois(pois: POI[], selectedId: string | null): void;
  showPosition(position: UserPosition): void;
  showRoute(polyline: [number, number][][]): void;
  locate(continuous: boolean, callback: (result: LocatedPosition | Error) => void): void;
  stopLocation(): void;
  destroy(): void;
}

export function classifyAmapLocation(result: any): LocatedPosition | Error {
  if (!result?.position) return new Error(result?.message || 'location_failed');
  const accuracy = Number.isFinite(result.accuracy) ? Number(result.accuracy) : null;
  const locationType = String(result.location_type ?? result.locationType ?? '').toLowerCase();
  const coarse = accuracy == null || accuracy > 1000 || locationType.includes('ip');
  return { position: { lng: Number(result.position.lng), lat: Number(result.position.lat), crs: 'GCJ02', source: 'amap_geolocation', accuracy_m: accuracy, timestamp: new Date().toISOString() }, coarse, sourceLabel: locationType.includes('ip') ? 'IP 城市级定位' : '高德定位' };
}

function sameOriginServiceHost(path: string): string {
  const url = new URL(path, location.origin);
  if (url.origin !== location.origin) throw new Error('service_host_not_same_origin');
  return url.href.replace(/\/$/, '');
}

export async function createOnlineMap(host: HTMLElement, config: MapPublicConfig, onSelect: (poiId: string) => void): Promise<OnlineMapHandle> {
  if (!config.js_key || config.status.online_map === 'NOT_CONFIGURED') throw new Error('map_not_configured');
  (window as typeof window & { _AMapSecurityConfig?: { serviceHost: string } })._AMapSecurityConfig = { serviceHost: sameOriginServiceHost(config.service_host) };
  const { load } = await import('@amap/amap-jsapi-loader');
  const AMap = await load({ key: config.js_key, version: '2.0', plugins: ['AMap.Geolocation', 'AMap.MarkerCluster', 'AMap.Scale'] }) as AMapApi;
  const map = new AMap.Map(host, { zoom: 15, viewMode: '2D' });
  if (AMap.Scale) map.addControl(new AMap.Scale());
  let markers: any[] = []; let cluster: any = null; let locationMarker: any = null; let accuracyCircle: any = null; let routeLine: any = null; let geolocation: any = null; let watchId: number | null = null;
  function clearMarkers() { if (cluster?.setMap) cluster.setMap(null); if (markers.length) map.remove(markers); markers = []; cluster = null; }
  function setPois(pois: POI[], selectedId: string | null) {
    clearMarkers();
    markers = pois.filter((poi) => poi.location?.crs === 'GCJ02').map((poi) => {
      const marker = new AMap.Marker({ position: [poi.location!.lng, poi.location!.lat], title: poi.name, extData: { poiId: poi.id }, zIndex: poi.id === selectedId ? 140 : 100 });
      marker.on('click', () => onSelect(poi.id)); return marker;
    });
    if (!markers.length) return;
    if (AMap.MarkerCluster && markers.length > 8) cluster = new AMap.MarkerCluster(map, markers, { gridSize: 60 }); else map.add(markers);
    map.setFitView(markers, false, [48, 48, 48, 48], 17);
  }
  function showPosition(position: UserPosition) {
    const point = [position.lng, position.lat];
    if (!locationMarker) locationMarker = new AMap.Marker({ position: point, title: '我的位置', zIndex: 200 }); else locationMarker.setPosition(point);
    if (!accuracyCircle) accuracyCircle = new AMap.Circle({ center: point, radius: position.accuracy_m ?? 0, strokeColor: '#147da5', fillColor: '#4cc3d8', fillOpacity: .14 });
    else { accuracyCircle.setCenter(point); accuracyCircle.setRadius(position.accuracy_m ?? 0); }
    map.add([locationMarker, accuracyCircle]);
  }
  function showRoute(lines: [number, number][][]) {
    if (routeLine) map.remove(routeLine); const path = lines.flat(); if (path.length < 2) return;
    routeLine = new AMap.Polyline({ path, strokeColor: '#08779d', strokeWeight: 7, strokeOpacity: .86, showDir: true }); map.add(routeLine); map.setFitView([routeLine]);
  }
  function locate(continuous: boolean, callback: (result: LocatedPosition | Error) => void) {
    if (!geolocation) geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0, convert: true, showButton: false, showMarker: false, showCircle: false });
    const handler = (status: string, result: any) => callback(status === 'complete' ? classifyAmapLocation(result) : new Error(result?.message || (status === 'error' ? 'location_failed' : status)));
    if (continuous && geolocation.watchPosition) watchId = geolocation.watchPosition(handler); else geolocation.getCurrentPosition(handler);
  }
  function stopLocation() { if (watchId != null && geolocation?.clearWatch) geolocation.clearWatch(watchId); watchId = null; }
  return { setPois, showPosition, showRoute, locate, stopLocation, destroy() { stopLocation(); clearMarkers(); map.destroy(); } };
}
