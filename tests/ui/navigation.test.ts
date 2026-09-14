
import test from 'node:test';
import assert from 'node:assert/strict';
import {navigationFor,routeFor,OperationScope} from '../../frontend/src/ui/navigation-model.ts';
import type {ExternalNavigation,POI,RouteResponse} from '../../shared/r2.ts';

const a={id:'a',campus_id:'weijinlu'} as POI,b={id:'b',campus_id:'weijinlu'} as POI;
test('A01 stale external navigation cannot link a new entity card',()=>{
 const old={poi_id:'a',url:'https://uri.amap.com/search?keyword=A'} as ExternalNavigation;
 assert.ok(navigationFor(old,a));assert.equal(navigationFor(old,b),null);
 assert.equal(navigationFor({...old,url:'https://evil.example/nav'},a),null);
 assert.equal(navigationFor({...old,url:'javascript:alert(1)'},a),null);
});
test('A01 old routes cannot render under a different target',()=>{
 const route={destination_poi_id:'a'} as RouteResponse;
 assert.equal(routeFor(route,a),route);assert.equal(routeFor(route,b),null);
});
test('A04 rapid target or campus change invalidates delayed operations',async()=>{
 const scope=new OperationScope();const first=scope.begin();
 let release:()=>void=()=>undefined;
 const delayed=new Promise<void>(resolve=>{release=resolve;});
 let published=false;
 const result=delayed.then(()=>{if(first.current())published=true;});
 const second=scope.begin();release();await result;
 assert.equal(published,false);assert.equal(first.controller.signal.aborted,true);assert.equal(second.current(),true);
 scope.cancel();assert.equal(second.current(),false);
});
