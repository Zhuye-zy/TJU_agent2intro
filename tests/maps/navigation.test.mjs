import test from 'node:test';
import assert from 'node:assert/strict';
import {MapBudget} from '../../.runtime/adapter-build/map-budget.js';
import {AmapNavigation,routeNarration,speakRoute} from '../../.runtime/adapter-build/navigation.js';
const sig=()=>new AbortController().signal;
const limits={map_load:10,geolocation:10,poi_search:10,walking_route:10};
const config={js_key:'isolated-fixture',service_host:'/api/maps/amap/_AMapService',route_backend:'js_api',status:{security_key_configured:true,online_map:'UNVERIFIED'}};
const position=()=>({lng:1,lat:1,crs:'GCJ02',source:'amap_geolocation',accuracy_m:10,timestamp:new Date().toISOString()});
const poi=()=>({id:'fixture-poi',campus_id:'weijinlu',verification_status:'verified',location:{lng:1.01,lat:1.01,crs:'GCJ02',coordinate_source:'isolated-fixture',verified_at:'2026-01-01',quality:'building_center'},entrances:[]});
const request=()=>({route_id:'fixture-route',session_id:'fixture-session',campus_id:'weijinlu',destination_poi_id:'fixture-poi',entrance_id:null,origin:position(),user_initiated:true});
function fakeSdk(){
 const calls={map:0,geo:0,walk:0,clear:0};
 return {calls,sdk:{
  Map:class{constructor(){calls.map++}destroy(){}},
  Geolocation:class{getCurrentPosition(cb){calls.geo++;cb('complete',{position:{lng:1,lat:1},accuracy:10,location_type:'html5'});}},
  Walking:class{search(_a,_b,cb){calls.walk++;cb('complete',{routes:[{distance:120,time:90,steps:[{instruction:'沿测试步道前行',distance:120,path:[{lng:1,lat:1},{lng:1.01,lat:1.01}]}]}]});}clear(){calls.clear++;}}
 }};
}
test('each operation has separate counters and no claimed vendor debit',async()=>{
 const b=new MapBudget({limits});
 for(const kind of Object.keys(limits))await b.run(kind,kind,true,sig(),async()=>true);
 for(const kind of Object.keys(limits))assert.equal(b.snapshot().counters[kind].initiated,1);
 assert.equal(b.snapshot().platform_quota_debit,null);
});
test('consent and pre-aborted requests invoke zero SDK operations',async()=>{
 const b=new MapBudget();let calls=0;const invoke=async()=>calls++;
 await assert.rejects(b.run('geolocation','a',false,sig(),invoke),{code:'user_action_required'});
 const c=new AbortController();c.abort();await assert.rejects(b.run('geolocation','b',true,c.signal,invoke),{code:'cancelled'});
 assert.equal(calls,0);
});
test('default smoke budget blocks POI search and a second route',async()=>{
 let t=0;const b=new MapBudget({now:()=>t});let calls=0;
 await assert.rejects(b.run('poi_search','p',true,sig(),async()=>calls++),{code:'test_budget_exhausted'});
 await b.run('walking_route','r1',true,sig(),async()=>calls++);t=6000;
 await assert.rejects(b.run('walking_route','r2',true,sig(),async()=>calls++),{code:'test_budget_exhausted'});
 assert.equal(calls,1);
});
test('duplicate clicks and in-flight overlap do not call provider twice',async()=>{
 const b=new MapBudget({limits});let done;let calls=0;
 const pending=b.run('walking_route','same',true,sig(),()=>new Promise(r=>{calls++;done=r;}));
 await assert.rejects(b.run('walking_route','same',true,sig(),async()=>calls++),{code:'duplicate_operation'});
 await assert.rejects(b.run('walking_route','other',true,sig(),async()=>calls++),{code:'operation_in_progress'});
 done(true);await pending;assert.equal(calls,1);
});
test('five-second cooldown applies before starting another request',async()=>{
 let t=0;const b=new MapBudget({limits,now:()=>t});await b.run('walking_route','a',true,sig(),async()=>true);
 t=100;await assert.rejects(b.run('walking_route','b',true,sig(),async()=>true),{code:'rate_limited'});
});
test('failed or cancelled calls retain reservations and never retry',async()=>{
 const b=new MapBudget();let calls=0;
 await assert.rejects(b.run('walking_route','a',true,sig(),async()=>{calls++;throw Error('fixture_failure');}));
 assert.equal(calls,1);assert.equal(b.snapshot().counters.walking_route.failed,1);assert.equal(b.snapshot().counters.walking_route.initiated,1);
});
test('refresh keeps test reservations; corrupt storage fails closed',async()=>{
 const data=new Map();const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 await new MapBudget({storage}).run('walking_route','first',true,sig(),async()=>true);
 const refreshed=new MapBudget({storage});
 await assert.rejects(refreshed.run('walking_route','second',true,sig(),async()=>true),{code:'test_budget_exhausted'});
 assert.ok(!JSON.stringify([...data]).includes('first'));
 assert.throws(()=>new MapBudget({storage:{getItem:()=>'{broken',setItem(){}}}),{code:'budget_storage_invalid'});
});
test('JS navigation uses injected SDK and exposes steps, distance and time',async()=>{
 const f=fakeSdk();const nav=new AmapNavigation(config,new MapBudget(),async()=>f.sdk);
 await nav.createMap({},'m',sig(),true);
 const loc=await nav.locate('g',sig(),true);assert.equal(loc.accuracy_m,10);
 const route=await nav.walk(request(),poi(),sig());assert.equal(route.distance_m,120);assert.equal(route.duration_s,90);assert.equal(route.steps[0].instruction,'沿测试步道前行');
 assert.equal(route.campus_access,'unverified');assert.deepEqual(f.calls,{map:1,geo:1,walk:1,clear:1});
});
test('wrong campus, pending destination and stale origin spend zero route calls',async()=>{
 const f=fakeSdk();const nav=new AmapNavigation(config,new MapBudget(),async()=>f.sdk);
 await assert.rejects(nav.walk(request(),{...poi(),campus_id:'beiyangyuan'},sig()),{code:'poi_context_mismatch'});
 await assert.rejects(nav.walk(request(),{...poi(),location:null},sig()),{code:'destination_unverified'});
 await assert.rejects(nav.walk({...request(),origin:{...position(),timestamp:'2000-01-01'}},poi(),sig()),{code:'location_expired_or_inaccurate'});
 assert.equal(f.calls.walk,0);
});
test('cancelled SDK callback is ignored and counted only as cancelled',async()=>{
 let callback;let cleared=0;
 const f=fakeSdk();f.sdk.Walking=class{search(a,b,cb){callback=cb}clear(){cleared++}};
 const budget=new MapBudget();const nav=new AmapNavigation(config,budget,async()=>f.sdk);const c=new AbortController();
 const result=nav.walk(request(),poi(),c.signal);
 await new Promise(r=>setImmediate(r));c.abort();await assert.rejects(result,{code:'cancelled'});
 callback('complete',{routes:[]});assert.equal(cleared,1);assert.equal(budget.snapshot().counters.walking_route.cancelled,1);assert.equal(budget.snapshot().counters.walking_route.completed,0);
});
test('IP location can be displayed but is not accepted as a precise route origin',async()=>{
 const f=fakeSdk();f.sdk.Geolocation=class{getCurrentPosition(cb){cb('complete',{position:{lng:1,lat:1},accuracy:10000,location_type:'ip'})}};
 const nav=new AmapNavigation(config,new MapBudget(),async()=>f.sdk);
 const location=await nav.locate('g',sig(),true);
 assert.equal(location.accuracy_m,null);
 await assert.rejects(nav.walk({...request(),origin:location},poi(),sig()),{code:'location_expired_or_inaccurate'});
 assert.equal(f.calls.walk,0);
});

test('city IP lookup displays a coarse center and respects cancellation',async()=>{
 const f=fakeSdk();f.sdk.CitySearch=class {getLocalCity(cb){cb('complete',{bounds:'116,38;118,40'});}};
 const nav=new AmapNavigation(config,new MapBudget(),async()=>f.sdk);
 const result=await nav.locateCity('city',sig(),true);
 assert.equal(result.lng,117);assert.equal(result.lat,39);assert.equal(result.accuracy_m,null);
 const controller=new AbortController();controller.abort();
 await assert.rejects(nav.locateCity('cancel',controller.signal,true),{code:'cancelled'});
});
test('route narration delegates actual step text to the existing speech controller',async()=>{
 const route={distance_m:120,steps:[{instruction:'沿测试步道前行'}],campus_access:'unverified'};
 let text;await speakRoute({playFull:async(run,value)=>{text=value;return {status:'ready'}}},{},route);
 assert.equal(text,routeNarration(route));assert.ok(text.includes('沿测试步道前行'));assert.ok(text.includes('尚待核验'));
});

test('provider permission and timeout failures expose only safe codes',async()=>{
 for(const [message,code] of [['PERMISSION_DENIED secret fixture detail','permission_denied'],['TIME_OUT private fixture detail','location_timeout']]){
  const f=fakeSdk();f.sdk.Geolocation=class{getCurrentPosition(cb){cb('error',{message})}};
  const budget=new MapBudget();const nav=new AmapNavigation(config,budget,async()=>f.sdk);
  await assert.rejects(nav.locate('g',sig(),true),error=>error.code===code&&!error.message.includes('fixture'));
  assert.equal(budget.snapshot().counters.geolocation.failed,1);
 }
});
test('manual origins remain explicit and do not invent GPS accuracy',async()=>{
 const f=fakeSdk();const nav=new AmapNavigation(config,new MapBudget(),async()=>f.sdk);
 const req={...request(),origin:{...position(),source:'manual',accuracy_m:null}};
 assert.equal((await nav.walk(req,poi(),sig())).destination_poi_id,poi().id);
 const another=new AmapNavigation(config,new MapBudget(),async()=>f.sdk);
 await assert.rejects(another.walk({...req,origin:{...req.origin,accuracy_m:0}},poi(),sig()),{code:'location_expired_or_inaccurate'});
});
