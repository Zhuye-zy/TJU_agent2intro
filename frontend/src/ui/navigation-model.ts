import type { ExternalNavigation, POI, RouteResponse, UserPosition } from '../../../shared/r2';

/** A late response must never turn another entity's card into its navigation link. */
export function navigationFor(nav:ExternalNavigation|null, poi:POI|null):string|null {
  if (!nav || !poi || nav.poi_id!==poi.id || !nav.url) return null;
  try {const url=new URL(nav.url);return url.protocol==='https:' && ['uri.amap.com','www.amap.com','amap.com'].includes(url.hostname)?url.href:null;} catch {return null;}
}
export function routeFor(route:RouteResponse|null, poi:POI|null):RouteResponse|null {
  return route && poi && route.destination_poi_id===poi.id?route:null;
}
export class OperationScope {
  private revision=0;
  private active:AbortController|null=null;
  begin(){this.cancel();const revision=this.revision;const controller=new AbortController();this.active=controller;return {controller,current:()=>this.revision===revision&&!controller.signal.aborted};}
  cancel(){this.revision++;this.active?.abort();this.active=null;}
}

export interface LocatedPosition { position: UserPosition; coarse: boolean; sourceLabel: string }
export function classifyAmapLocation(result: any): LocatedPosition | Error {
  if (!result?.position) return new Error('location_failed');
  const lng = Number(result.position.lng), lat = Number(result.position.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng)>180 || Math.abs(lat)>90) return new Error('invalid_coordinates');
  const accuracy = Number.isFinite(result.accuracy) ? Number(result.accuracy) : null;
  const locationType = String(result.location_type ?? result.locationType ?? '').toLowerCase();
  const coarse = accuracy == null || accuracy < 0 || accuracy > 200 || locationType.includes('ip');
  return { position: { lng, lat, crs: 'GCJ02', source: 'amap_geolocation', accuracy_m: accuracy, timestamp: new Date().toISOString() }, coarse, sourceLabel: locationType.includes('ip') ? 'IP 城市级定位' : '高德定位' };
}
