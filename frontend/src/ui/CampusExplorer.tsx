import { useEffect, useMemo, useRef, useState } from 'react';
import type { CampusId } from '../../../shared/contracts';
import type { CampusAssets, ExternalNavigation, MapPublicConfig, MapStatus, POI, POICategory, RouteResponse, UserPosition } from '../../../shared/r2';
import { createOnlineMap, type LocatedPosition, type OnlineMapHandle } from '../scene/amap';
import { r2Transport } from '../transport/r2';
import { freshUuid, safeSourceUrl } from './model';
import { mergePoiPages } from './r2-model';

const CATEGORY_LABELS: Record<POICategory | 'all', string> = { all: '全部', teaching: '教学', library: '图书馆', gate: '校门', dining: '餐饮', dorm_area: '宿舍区', sports: '体育', culture: '文化', service: '服务', other: '其他' };
type LocationState = 'idle' | 'locating' | 'ready' | 'coarse' | 'denied' | 'timeout' | 'stopped' | 'error' | 'manual';
type StartPoint = Omit<UserPosition, 'source'> & { source: 'amap_geolocation' | 'manual' };

interface Props {
  campus: CampusId;
  sessionId: string;
  focusPoiId: string | null;
  onSelect(poi: POI | null): void;
  onAssets(assets: CampusAssets | null): void;
  onAsk(prompt: string, poi: POI): void;
}

function mapErrorMessage(error: unknown): string {
  const value = String(error instanceof Error ? error.message : error).toLowerCase();
  if (value.includes('permission') || value.includes('denied') || value.includes('拒绝')) return '定位权限被拒绝，可改用手动起点。';
  if (value.includes('timeout') || value.includes('超时')) return '定位超时，可重试或设置手动起点。';
  return '定位服务暂不可用，可继续浏览点位。';
}

export function CampusExplorer({ campus, sessionId, focusPoiId, onSelect, onAssets, onAsk }: Props) {
  const [items, setItems] = useState<POI[]>([]); const [total, setTotal] = useState<number | null>(null); const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [queryDraft, setQueryDraft] = useState(''); const [query, setQuery] = useState(''); const [category, setCategory] = useState<POICategory | 'all'>('all'); const [loading, setLoading] = useState(false); const [directoryError, setDirectoryError] = useState('');
  const [selected, setSelected] = useState<POI | null>(null); const [assets, setAssets] = useState<CampusAssets | null>(null); const [zoom, setZoom] = useState(1); const [view, setView] = useState<'local' | 'online'>('local');
  const [mapStatus, setMapStatus] = useState<MapStatus | null>(null); const [mapConfig, setMapConfig] = useState<MapPublicConfig | null>(null); const [onlineError, setOnlineError] = useState('');
  const [locationState, setLocationState] = useState<LocationState>('idle'); const [locationMessage, setLocationMessage] = useState('尚未请求定位'); const [position, setPosition] = useState<StartPoint | null>(null); const [continuous, setContinuous] = useState(false);
  const [manualLng, setManualLng] = useState(''); const [manualLat, setManualLat] = useState(''); const [externalNav, setExternalNav] = useState<ExternalNavigation | null>(null); const [route, setRoute] = useState<RouteResponse | null>(null); const [routeBusy, setRouteBusy] = useState(false); const [routeError, setRouteError] = useState('');
  const operationRef = useRef(0); const selectedRef = useRef<POI | null>(null); const onlineHostRef = useRef<HTMLDivElement>(null); const onlineRef = useRef<OnlineMapHandle | null>(null); const routeAbortRef = useRef<AbortController | null>(null); const routeIdRef = useRef<string | null>(null); const lastRouteClickRef = useRef(0);
  const activeMap = assets?.maps[0] ?? null;

  useEffect(() => { selectedRef.current = selected; onSelect(selected); }, [selected, onSelect]);
  useEffect(() => { if (focusPoiId) { const match = items.find((item) => item.id === focusPoiId); if (match) setSelected(match); } }, [focusPoiId, items]);
  useEffect(() => {
    const generation = ++operationRef.current; setItems([]); setTotal(null); setNextCursor(null); setSelected(null); setRoute(null); setRouteError(''); setDirectoryError(''); setZoom(1); setView('local');
    routeAbortRef.current?.abort(); if (routeIdRef.current) void r2Transport.cancelRoute(routeIdRef.current, sessionId).catch(() => undefined); routeIdRef.current = null;
    const options = { ...(category !== 'all' ? { category } : {}), ...(query ? { query } : {}), limit: 20 };
    setLoading(true);
    Promise.allSettled([r2Transport.pois(campus, options), r2Transport.campusAssets(campus), r2Transport.mapStatus(), r2Transport.mapConfig()]).then((results) => {
      if (operationRef.current !== generation) return;
      if (results[0].status === 'fulfilled') { setItems(results[0].value.items); setTotal(results[0].value.total); setNextCursor(results[0].value.next_cursor); setSelected(results[0].value.items[0] ?? null); }
      else setDirectoryError('点位目录尚未集成或暂不可用。');
      if (results[1].status === 'fulfilled') { setAssets(results[1].value); onAssets(results[1].value); } else { setAssets(null); onAssets(null); }
      if (results[2].status === 'fulfilled') setMapStatus(results[2].value); else setOnlineError('在线地图状态接口尚未集成。');
      if (results[3].status === 'fulfilled') setMapConfig(results[3].value); else setOnlineError('在线地图未配置或配置接口尚未集成。');
    }).finally(() => { if (operationRef.current === generation) setLoading(false); });
    return () => { operationRef.current += 1; };
  }, [campus, category, query, sessionId, onAssets]);

  useEffect(() => {
    let active = true;
    if (!selected) { setExternalNav(null); return; }
    r2Transport.externalNavigation(selected.id).then((value) => { if (active && selectedRef.current?.id === value.poi_id) setExternalNav(value); }).catch(() => { if (active) setExternalNav(null); });
    return () => { active = false; };
  }, [selected]);

  useEffect(() => {
    if (view !== 'online' || !onlineHostRef.current || !mapConfig) return;
    let active = true; setOnlineError('');
    createOnlineMap(onlineHostRef.current, mapConfig, (id) => { const poi = items.find((item) => item.id === id); if (poi) setSelected(poi); }).then((handle) => {
      if (!active) { handle.destroy(); return; } onlineRef.current = handle; handle.setPois(items, selectedRef.current?.id ?? null); if (position?.source === 'amap_geolocation') handle.showPosition(position as UserPosition);
    }).catch((error) => { if (active) setOnlineError(String(error).includes('not_configured') ? '在线地图未配置。' : '在线地图加载失败，可继续使用本地图。'); });
    return () => { active = false; onlineRef.current?.destroy(); onlineRef.current = null; };
  }, [view, mapConfig]);
  useEffect(() => { onlineRef.current?.setPois(items, selected?.id ?? null); }, [items, selected]);
  useEffect(() => { if (position?.source === 'amap_geolocation') onlineRef.current?.showPosition(position as UserPosition); }, [position]);
  useEffect(() => { if (view === 'local' && continuous) { onlineRef.current?.stopLocation(); setContinuous(false); setLocationState('stopped'); setLocationMessage('已离开在线地图并停止持续定位，保留最后一次位置。'); } }, [view, continuous]);

  async function loadMore() {
    if (!nextCursor || loading) return; const generation = operationRef.current; setLoading(true);
    try {
      const page = await r2Transport.pois(campus, { ...(category !== 'all' ? { category } : {}), ...(query ? { query } : {}), limit: 20, cursor: nextCursor });
      if (operationRef.current !== generation) return;
      setItems((current) => mergePoiPages(current, page.items)); setTotal(page.total); setNextCursor(page.next_cursor);
    } catch { if (operationRef.current === generation) setDirectoryError('下一页点位加载失败，请重试。'); } finally { if (operationRef.current === generation) setLoading(false); }
  }

  function beginLocation(useContinuous: boolean) {
    if (!onlineRef.current) { setLocationState('error'); setLocationMessage('请先启用已配置的在线地图，再请求定位。'); return; }
    setLocationState('locating'); setLocationMessage(useContinuous ? '正在持续定位…' : '正在获取一次位置…'); setContinuous(useContinuous);
    onlineRef.current.locate(useContinuous, (result: LocatedPosition | Error) => {
      if (result instanceof Error) { const message = mapErrorMessage(result); setLocationMessage(message); setLocationState(message.includes('拒绝') ? 'denied' : message.includes('超时') ? 'timeout' : 'error'); return; }
      setPosition(result.position); setLocationState(result.coarse ? 'coarse' : 'ready'); setLocationMessage(result.coarse ? `${result.sourceLabel}，仅供城市级参考，不是精准 GPS。` : `${result.sourceLabel}，精度约 ${result.position.accuracy_m == null ? '未返回' : Math.round(result.position.accuracy_m) + ' 米'}。`);
    });
  }
  function stopLocation() { onlineRef.current?.stopLocation(); setContinuous(false); setLocationState('stopped'); setLocationMessage('持续定位已停止，保留最后一次位置。'); }
  function applyManualStart() {
    const lng = Number(manualLng); const lat = Number(manualLat);
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < 70 || lng > 140 || lat < 0 || lat > 60) { setLocationMessage('请输入有效的 GCJ-02 经度和纬度。'); return; }
    setPosition({ lng, lat, crs: 'GCJ02', source: 'manual', accuracy_m: null, timestamp: new Date().toISOString() }); setLocationState('manual'); setLocationMessage('已设置手动起点；不会冒充 GPS，当前契约下仅用于页面参考。');
  }
  async function planRoute() {
    if (!selected || !position || position.source !== 'amap_geolocation' || locationState !== 'ready') { setRouteError('应用内路线需要一次非粗略的授权定位；也可使用外部导航。'); return; }
    if (mapStatus?.in_app_routing !== 'VERIFIED') { setRouteError('应用内步行规划尚未验证；请使用外部导航。'); return; }
    if (Date.now() - lastRouteClickRef.current < 500 || routeBusy) return; lastRouteClickRef.current = Date.now(); setRouteBusy(true); setRouteError(''); setRoute(null);
    const routeId = freshUuid(routeIdRef.current ?? undefined); routeIdRef.current = routeId; const controller = new AbortController(); routeAbortRef.current = controller;
    try {
      const result = await r2Transport.planRoute({ route_id: routeId, session_id: sessionId, campus_id: campus, destination_poi_id: selected.id, entrance_id: null, origin: position as UserPosition, user_initiated: true }, controller.signal);
      if (routeIdRef.current !== routeId || selectedRef.current?.id !== result.destination_poi_id) return; setRoute(result); const lines = result.steps.map((step) => step.polyline).filter((line) => line.length > 1); if (lines.length) onlineRef.current?.showRoute(lines);
    } catch { if (routeIdRef.current === routeId) setRouteError('路线规划失败或受限，可改用外部导航。'); } finally { if (routeIdRef.current === routeId) setRouteBusy(false); }
  }

  const filteredSchematic = useMemo(() => activeMap ? items.filter((item) => item.schematic_position?.map_id === activeMap.id) : [], [items, activeMap]);
  const externalUrl = externalNav?.url ? safeSourceUrl(externalNav.url) : null;
  return <section className="explorer" aria-label="校园地图与点位目录">
    <div className="explorer-toolbar"><form onSubmit={(event) => { event.preventDefault(); setQuery(queryDraft.trim()); }}><input value={queryDraft} maxLength={100} onChange={(event) => setQueryDraft(event.target.value)} placeholder="搜索点位或别名" aria-label="搜索点位"/><button type="submit">搜索</button></form><select value={category} onChange={(event) => setCategory(event.target.value as POICategory | 'all')} aria-label="点位分类">{Object.entries(CATEGORY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select><div className="map-kind-tabs"><button className={view === 'local' ? 'active' : ''} onClick={() => setView('local')}>本地图</button><button className={view === 'online' ? 'active' : ''} onClick={() => setView('online')}>在线地图</button></div></div>
    <div className="map-directory"><div className="map-surface">
      {view === 'local' ? <div className="schematic-viewport"><div className="map-zoom"><button aria-label="放大本地图" onClick={() => setZoom((value) => Math.min(2, value + .2))}>＋</button><button aria-label="缩小本地图" onClick={() => setZoom((value) => Math.max(.7, value - .2))}>−</button></div>{activeMap && activeMap.local_path.startsWith('/assets/campus/') ? <div className="schematic-layer" style={{ transform: `scale(${zoom})`, backgroundImage: `url(${JSON.stringify(activeMap.local_path).slice(1, -1)})` }}>{filteredSchematic.map((poi) => <button key={poi.id} style={{ left: `${poi.schematic_position!.x * 100}%`, top: `${poi.schematic_position!.y * 100}%` }} className={selected?.id === poi.id ? 'selected' : ''} title={poi.name} onClick={() => setSelected(poi)}><span>{poi.name}</span></button>)}</div> : <div className="map-empty"><strong>暂无可用校园图面</strong><span>点位目录仍可独立浏览；不会用其他学校或生成图片替代。</span></div>}<div className="map-attribution">{activeMap ? `图面：${activeMap.creator} · ${activeMap.usage_basis}` : '图面来源未返回'}</div></div> : <div className="online-map-wrap"><div ref={onlineHostRef} className="online-map-host"/>{onlineError && <div className="map-empty overlay"><strong>{onlineError}</strong><button onClick={() => setView('local')}>返回本地图</button></div>}</div>}
      <div className="location-panel"><div><strong>我的起点</strong><span>{locationMessage}{position && ` 更新时间 ${new Date(position.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}`}</span></div><div className="location-actions"><button disabled={view !== 'online' || locationState === 'locating'} title={view !== 'online' ? '请先切换到在线地图' : undefined} onClick={() => beginLocation(false)}>定位一次</button><button disabled={view !== 'online' || continuous} title={view !== 'online' ? '请先切换到在线地图' : undefined} onClick={() => beginLocation(true)}>持续定位</button>{continuous && <button onClick={stopLocation}>停止定位</button>}</div><details><summary>设置手动起点</summary><div><input value={manualLng} onChange={(event) => setManualLng(event.target.value)} inputMode="decimal" placeholder="GCJ-02 经度" aria-label="手动起点经度"/><input value={manualLat} onChange={(event) => setManualLat(event.target.value)} inputMode="decimal" placeholder="GCJ-02 纬度" aria-label="手动起点纬度"/><button onClick={applyManualStart}>应用</button></div></details></div>
    </div><aside className="poi-directory"><div className="directory-summary"><strong>点位目录</strong><span>{total == null ? `${items.length} 项已加载` : `${items.length} / ${total}`}</span></div>{directoryError && <p className="inline-error">{directoryError}</p>}<div className="poi-list">{items.map((poi) => <button key={poi.id} className={selected?.id === poi.id ? 'selected' : ''} onClick={() => setSelected(poi)}><span>{CATEGORY_LABELS[poi.category]}</span><strong>{poi.name}</strong><small>{poi.verification_status === 'verified' ? '资料已核验' : '资料待核验'}</small></button>)}</div>{nextCursor && <button className="load-more" disabled={loading} onClick={() => void loadMore()}>{loading ? '加载中…' : '加载更多'}</button>}{!loading && !items.length && !directoryError && <p className="directory-empty">没有符合条件的点位。</p>}</aside></div>
    {selected && <article className="poi-card" data-poi-id={selected.id}><div><span>{CATEGORY_LABELS[selected.category]}</span><h3>{selected.name}</h3><p>{selected.description}</p><small>稳定 ID：{selected.id} · {selected.location ? `${selected.location.quality} / ${selected.location.coordinate_source}` : '无导航坐标'}</small></div><div className="poi-actions"><button onClick={() => onAsk(`请展开讲讲${selected.name}。`, selected)}>展开讲讲</button><button onClick={() => { setView('local'); document.querySelector('.map-surface')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }}>在地图查看</button>{externalUrl ? <a href={externalUrl} target="_blank" rel="noreferrer">外部导航{externalNav?.precision === 'name_search' ? '（按名称）' : ''}</a> : <span title={externalNav?.kind === 'unavailable' ? '该点位不满足已核验导航条件' : '导航入口未返回'}>外部导航未提供</span>}<button disabled={!position || position.source !== 'amap_geolocation' || locationState !== 'ready' || mapStatus?.in_app_routing !== 'VERIFIED' || routeBusy} title={!position ? '请先授权定位' : position.source === 'manual' ? '手动起点当前仅供参考' : mapStatus?.in_app_routing !== 'VERIFIED' ? '应用内路线尚未验证' : undefined} onClick={() => void planRoute()}>{routeBusy ? '规划中…' : '从我这里出发'}</button></div></article>}
    {routeError && <p className="inline-error route-error">{routeError}</p>}{route && <details className="route-result" open><summary>步行方案 · {Math.round(route.distance_m)} 米{route.duration_s == null ? '' : ` · 约 ${Math.ceil(route.duration_s / 60)} 分钟`}</summary><p>{route.campus_access === 'verified' ? '校园通行信息有资料依据。' : '校内门禁与道路通行尚未核验，请以现场为准。'}</p><ol>{route.steps.map((step, index) => <li key={`${index}-${step.instruction}`}>{step.instruction} · {Math.round(step.distance_m)} 米</li>)}</ol></details>}
  </section>;
}
