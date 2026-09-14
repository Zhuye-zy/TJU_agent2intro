// M-owned JS API operations. A owns map/UI lifecycle, C owns the security proxy.
// No key literals, no REST calls, no position/route persistence, no automatic retry.
import type {MapPublicConfig,POI,RouteRequest,RouteResponse,UserPosition,SpeechController,SpeechRun} from '../../../shared/r2';
import {MapBudget,MapCallError} from './map-budget';
type Pair=[number,number];
type LngLat={getLng():number;getLat():number};
type Callback=(status:string,result:unknown)=>void;
interface Geo {getCurrentPosition(callback:Callback):void}
interface Walking {search(origin:Pair,destination:Pair,callback:Callback):void;clear():void}
export interface MapHandle {destroy():void}
export interface AmapSdk {
 Map:new(host:HTMLElement,options:Record<string,unknown>)=>MapHandle;
 Geolocation:new(options:Record<string,unknown>)=>Geo;
 Walking:new(options:Record<string,unknown>)=>Walking;
}
type Loader=(config:MapPublicConfig)=>Promise<AmapSdk>;
const loadSdk:Loader=async config=>{
 if(!config.js_key||!config.status.security_key_configured)throw new MapCallError('map_not_configured');
 (window as Window&{_AMapSecurityConfig?:{serviceHost:string}})._AMapSecurityConfig={serviceHost:window.location.origin+config.service_host};
 const loader=await import('@amap/amap-jsapi-loader');
 return await loader.default.load({key:config.js_key,version:'2.0',plugins:['AMap.Geolocation','AMap.Walking']}) as AmapSdk;
};
function pair(value:unknown):Pair {
 const p=value as Partial<LngLat>&{lng?:number;lat?:number};
 const lng=typeof p?.getLng==='function'?p.getLng():p?.lng;
 const lat=typeof p?.getLat==='function'?p.getLat():p?.lat;
 if(typeof lng!=='number'||typeof lat!=='number'||!Number.isFinite(lng)||!Number.isFinite(lat)||Math.abs(lng)>180||Math.abs(lat)>90)throw new MapCallError('invalid_coordinates');
 return [lng,lat];
}
function callbackResult<T>(signal:AbortSignal,invoke:(done:Callback)=>void,parse:(value:unknown)=>T,cleanup:()=>void=()=>{},timeoutMs=15000):Promise<T>{
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(error:unknown,value?:T)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);cleanup();if(error)reject(error);else resolve(value as T);};
  const abort=()=>finish(new MapCallError('cancelled'));
  const timer=setTimeout(()=>finish(new MapCallError('map_timeout')),timeoutMs);
  signal.addEventListener('abort',abort,{once:true});
  if(signal.aborted){abort();return;}
  try {invoke((status,result)=>{if(settled)return;if(status!=='complete'){
     const data=result as {info?:unknown;message?:unknown;code?:unknown}|null;
     const reason=[data?.info,data?.message,data?.code].filter(x=>typeof x==='string').join(' ').toUpperCase();
     const code=/PERMISSION_DENIED|USER_DENIED|USER DENIED/.test(reason)?'permission_denied':/TIME_OUT|TIMEOUT|TIME OUT/.test(reason)?'location_timeout':status==='no_data'?'route_no_data':'map_provider_failed';
     finish(new MapCallError(code));return;
    }try{finish(null,parse(result));}catch(error){finish(error);}});}catch(error){finish(error);}
 });
}
export class AmapNavigation {
 private sdk:AmapSdk|null=null;
 private loading:Promise<AmapSdk>|null=null;
 private config:MapPublicConfig;
 readonly budget:MapBudget;
 private loader:Loader;
 constructor(config:MapPublicConfig,budget:MapBudget,loader:Loader=loadSdk){this.config=config;this.budget=budget;this.loader=loader;}
 private assertReady(){
  if(!this.config.js_key||!this.config.status.security_key_configured)throw new MapCallError('map_not_configured');
  if(!['UNVERIFIED','VERIFIED'].includes(this.config.status.online_map))throw new MapCallError('map_proxy_not_ready');
 }
 private async getSdk(){
  this.assertReady();
  if(!this.config.js_key||!this.config.status.security_key_configured)throw new MapCallError('map_not_configured');
  if(this.sdk)return this.sdk;
  if(!this.loading)this.loading=this.loader(this.config).then(sdk=>{this.sdk=sdk;return sdk;}); // Failure is sticky, no hidden retry.
  return this.loading;
 }
 async createMap(host:HTMLElement,operationId:string,signal:AbortSignal,userInitiated:boolean,options:Record<string,unknown>={}):Promise<MapHandle>{
  this.assertReady();
  return this.budget.run('map_load',operationId,userInitiated,signal,async()=>{
   const sdk=await this.getSdk();if(signal.aborted)throw new MapCallError('cancelled');
   const handle=new sdk.Map(host,{zoom:15,...options});
   if(signal.aborted){handle.destroy();throw new MapCallError('cancelled');}
   return handle;
  });
 }
 async locate(operationId:string,signal:AbortSignal,userConsented:boolean):Promise<UserPosition>{
  this.assertReady();
  return this.budget.run('geolocation',operationId,userConsented,signal,async()=>{
   const sdk=await this.getSdk();if(signal.aborted)throw new MapCallError('cancelled');
   const geo=new sdk.Geolocation({enableHighAccuracy:true,timeout:10000,convert:true,showMarker:false,showCircle:false,panToLocation:false});
   return callbackResult(signal,done=>geo.getCurrentPosition(done),value=>{
    const result=value as {position:LngLat;accuracy?:number;location_type?:string};const [lng,lat]=pair(result.position);
    // IP-level/unknown accuracy is not a verified current-position route origin.
    if(result.location_type==='ip'||typeof result.accuracy!=='number'||!Number.isFinite(result.accuracy)||result.accuracy<0||result.accuracy>200)throw new MapCallError('location_accuracy_unverified');
    return {lng,lat,crs:'GCJ02',source:'amap_geolocation',accuracy_m:result.accuracy,timestamp:new Date().toISOString()};
   });
  });
 }
 async walk(request:RouteRequest,poi:POI,signal:AbortSignal):Promise<RouteResponse>{
  if(poi.id!==request.destination_poi_id||poi.campus_id!==request.campus_id)throw new MapCallError('poi_context_mismatch');
  const entrance=request.entrance_id?poi.entrances.find(x=>x.id===request.entrance_id):null;
  if(request.entrance_id&&!entrance)throw new MapCallError('entrance_not_found');
  const target=entrance?entrance.location:poi.location;
  if(!target||target.crs!=='GCJ02'||target.quality==='pending'||target.quality==='approximate'||!target.verified_at||poi.verification_status!=='verified')throw new MapCallError('destination_unverified');
  const origin=request.origin;pair(origin);pair(target);
  const age=Date.now()-Date.parse(origin.timestamp);
  if(origin.crs!=='GCJ02'||!['manual','amap_geolocation'].includes(origin.source)||(origin.source==='amap_geolocation'&&(origin.accuracy_m===null||!Number.isFinite(origin.accuracy_m)||origin.accuracy_m<0||origin.accuracy_m>200))||(origin.source==='manual'&&origin.accuracy_m!==null)||!Number.isFinite(age)||age< -5000||age>120000)throw new MapCallError('location_expired_or_inaccurate');
  this.assertReady();
  return this.budget.run('walking_route',request.route_id,request.user_initiated,signal,async()=>{
   const sdk=await this.getSdk();if(signal.aborted)throw new MapCallError('cancelled');const walking=new sdk.Walking({});
   return callbackResult(signal,done=>walking.search([origin.lng,origin.lat],[target.lng,target.lat],done),value=>{
    const raw=(value as {routes?:Array<{distance:number;time?:number;steps?:Array<{instruction:string;distance:number;path:LngLat[]}>}>}).routes?.[0];
    if(!raw||!Number.isFinite(raw.distance)||raw.distance<0||!raw.steps?.length)throw new MapCallError('invalid_route_result');
    const steps=raw.steps.map(step=>{
     if(typeof step.instruction!=='string'||!step.instruction.trim()||!Number.isFinite(step.distance)||step.distance<0||!Array.isArray(step.path))throw new MapCallError('invalid_route_step');
     return {instruction:step.instruction,distance_m:step.distance,polyline:step.path.map(pair)};
    });
    return {route_id:request.route_id,destination_poi_id:poi.id,provider:'amap',crs:'GCJ02',distance_m:raw.distance,duration_s:typeof raw.time==='number'&&Number.isFinite(raw.time)&&raw.time>=0?raw.time:null,steps,campus_access:'unverified',access_source_refs:[]};
   },()=>walking.clear());
  });
 }
}
export function routeNarration(route:RouteResponse):string {
 return ['步行路线，全程约'+Math.round(route.distance_m)+'米。',...route.steps.map((s,i)=>'第'+(i+1)+'步，'+s.instruction),...(route.campus_access==='unverified'?['校园入口、门禁和道路实际通行情况尚待核验。']:[])].join('\n');
}
export async function speakRoute(controller:SpeechController,run:SpeechRun,route:RouteResponse){
 // B's existing controller owns the common sanitizer/FIFO/player; no extra TTS/LLM chain.
 return controller.playFull(run,routeNarration(route));
}
