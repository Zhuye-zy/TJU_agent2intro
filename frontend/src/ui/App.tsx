import { Fragment, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import type { ApiError, AvatarAdapter, AvatarState, Building, CampusId, ChatResponse, Health, KnowledgeStatus, Mode, RuntimeEvent, Source, SpeechAdapter, Voice } from '../../../shared/contracts';
import { createAvatarAdapter } from '../avatar/adapter';
import { createSpeechAdapter } from '../speech/adapter';
import { CampusCardSceneAdapter } from '../scene/adapter';
import { transport } from '../transport/api';
import { errorMessage, freshUuid, isCurrentOperation, mergeRuntimeEvents, safeSourceUrl, sanitizedLogExport } from './model';
import './style.css';

type MessageStatus = 'waiting' | 'done' | 'error' | 'cancelled';
interface DisplayMessage {
  id: string; role: 'user' | 'assistant'; text: string; requestId: string; status: MessageStatus;
  sources?: Source[]; model?: string; usage?: ChatResponse['usage']; elapsedMs?: number;
}
interface Preferences { campus: CampusId; autoSpeak: boolean; avatarScale: number; backdrop: 'blueprint' | 'quiet' }
const DEFAULT_PREFS: Preferences = { campus: 'weijinlu', autoSpeak: false, avatarScale: 1, backdrop: 'blueprint' };
const CAMPUS_NAMES: Record<CampusId, string> = { weijinlu: '卫津路校区', beiyangyuan: '北洋园校区' };
const MODE_LABELS: Record<Mode, string> = { campus_qa: '校园问答', general_chat: '普通聊天', content_generation: '内容生成' };
const AVATAR_LABELS: Record<AvatarState, string> = { idle: '随时为你导览', listening: '正在听你说', thinking: '正在查找与思考', speaking: '正在为你讲解', error: '暂时无法响应' };

function readPreferences(): Preferences {
  try {
    const saved = JSON.parse(localStorage.getItem('ai4tju.preferences') ?? '{}') as Partial<Preferences>;
    return {
      campus: saved.campus === 'beiyangyuan' ? 'beiyangyuan' : 'weijinlu', autoSpeak: saved.autoSpeak === true,
      avatarScale: typeof saved.avatarScale === 'number' ? Math.min(1.25, Math.max(.8, saved.avatarScale)) : 1,
      backdrop: saved.backdrop === 'quiet' ? 'quiet' : 'blueprint',
    };
  } catch { return DEFAULT_PREFS; }
}

type IconName = 'send' | 'stop' | 'mic' | 'logs' | 'trash' | 'retry' | 'volume' | 'settings' | 'pin' | 'download' | 'close';
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactElement> = {
    send: <><path d="M4 4l17 8-17 8 3-8-3-8Z"/><path d="M7 12h14"/></>, stop: <rect x="6" y="6" width="12" height="12" rx="2"/>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></>,
    logs: <><path d="M5 4h14M5 10h14M5 16h9"/><circle cx="3" cy="4" r=".5"/><circle cx="3" cy="10" r=".5"/><circle cx="3" cy="16" r=".5"/></>,
    trash: <><path d="M4 7h16M9 3h6l1 4M7 7l1 14h8l1-14"/></>, retry: <><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></>,
    volume: <><path d="M5 10v4h4l5 4V6l-5 4H5Z"/><path d="M17 9a4 4 0 0 1 0 6"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></>,
    pin: <><path d="M12 21s6-5.2 6-12a6 6 0 0 0-12 0c0 6.8 6 12 6 12Z"/><circle cx="12" cy="9" r="2"/></>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M4 20h16"/></>, close: <><path d="M5 5l14 14M19 5 5 19"/></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function inlineText(text: string) {
  return text.split(/(`[^`]+`|\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) { const href = safeSourceUrl(link[2]); return href ? <a key={index} href={href} target="_blank" rel="noreferrer">{link[1]}</a> : <Fragment key={index}>{link[1]}</Fragment>; }
    return <Fragment key={index}>{part}</Fragment>;
  });
}
function RichText({ text }: { text: string }) {
  return <div className="rich-text">{text.replace(/\r\n/g, '\n').split('\n').map((line, index) => {
    const bullet = /^\s*[-*]\s+(.+)/.exec(line); const numbered = /^\s*\d+[.)]\s+(.+)/.exec(line); const heading = /^#{1,3}\s+(.+)/.exec(line);
    if (!line.trim()) return <br key={index}/>;
    if (heading) return <strong className="rich-heading" key={index}>{inlineText(heading[1])}</strong>;
    if (bullet || numbered) return <div className="rich-list" key={index}><span>{bullet ? '•' : '—'}</span><span>{inlineText((bullet ?? numbered)![1])}</span></div>;
    return <p key={index}>{inlineText(line)}</p>;
  })}</div>;
}
function StatusPill({ tone, children }: { tone: 'ready' | 'pending' | 'off'; children: ReactNode }) { return <span className={`status-pill ${tone}`}><span aria-hidden="true"/>{children}</span>; }

export function App() {
  const [prefs, setPrefs] = useState(readPreferences); const [health, setHealth] = useState<Health | null>(null); const [knowledge, setKnowledge] = useState<KnowledgeStatus | null>(null);
  const [serviceError, setServiceError] = useState(false); const [mode, setMode] = useState<Mode>('campus_qa'); const [input, setInput] = useState('');
  const [messages, setMessages] = useState<DisplayMessage[]>([]); const [buildings, setBuildings] = useState<Building[]>([]); const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [buildingsLoading, setBuildingsLoading] = useState(true); const [buildingNotice, setBuildingNotice] = useState(''); const [notice, setNotice] = useState('');
  const [events, setEvents] = useState<RuntimeEvent[]>([]); const [logsOpen, setLogsOpen] = useState(false); const [settingsOpen, setSettingsOpen] = useState(false); const [sourcesOpenFor, setSourcesOpenFor] = useState<string | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>('idle'); const [avatarReady, setAvatarReady] = useState(false); const [avatarMessage, setAvatarMessage] = useState('正在连接人物渲染器…');
  const [voices, setVoices] = useState<Voice[]>([]); const [speechBusy, setSpeechBusy] = useState(false); const [busy, setBusy] = useState(false); const [truncatedLogs, setTruncatedLogs] = useState(false);
  const sessionRef = useRef(freshUuid()); const requestRef = useRef<string | null>(null); const generationRef = useRef(0); const abortRef = useRef<AbortController | null>(null); const pollStopRef = useRef<(() => void) | null>(null);
  const avatarHostRef = useRef<HTMLDivElement>(null); const avatarRef = useRef<AvatarAdapter | null>(null); const speechRef = useRef<SpeechAdapter | null>(null); const composingRef = useRef(false); const selectedBuildingRef = useRef<Building | null>(null);

  useEffect(() => { selectedBuildingRef.current = selectedBuilding; }, [selectedBuilding]);
  useEffect(() => { localStorage.setItem('ai4tju.preferences', JSON.stringify(prefs)); }, [prefs]);
  useEffect(() => {
    let active = true; const avatar = createAvatarAdapter(); const speech = createSpeechAdapter(); avatarRef.current = avatar; speechRef.current = speech;
    Promise.all([transport.health(), transport.knowledgeStatus()]).then(([h, k]) => { if (active) { setHealth(h); setKnowledge(k); setServiceError(false); } }).catch(() => { if (active) setServiceError(true); });
    if (avatarHostRef.current) avatar.mount(avatarHostRef.current).then((result) => { if (active) { setAvatarReady(result.status === 'ready'); setAvatarMessage(result.status === 'ready' ? '人物已就位' : result.status === 'failed' ? '人物渲染失败' : '人物渲染尚未接入'); } }).catch(() => { if (active) setAvatarMessage('人物渲染失败'); });
    speech.listVoices().then((items) => { if (active) setVoices(items); }).catch(() => { if (active) setVoices([]); });
    return () => { active = false; generationRef.current += 1; abortRef.current?.abort(); pollStopRef.current?.(); avatar.dispose(); if (requestRef.current) void speech.stop(requestRef.current); };
  }, []);
  useEffect(() => {
    let active = true; setBuildingsLoading(true); setBuildingNotice('');
    transport.buildings(prefs.campus).then(({ buildings: next }) => { if (!active) return; setBuildings(next); setSelectedBuilding((current) => next.find((item) => item.id === current?.id) ?? next[0] ?? null); if (!next.length) setBuildingNotice('当前校区暂无已核实点位。'); })
      .catch(() => { if (active) { setBuildings([]); setSelectedBuilding(null); setBuildingNotice('校园点位服务暂不可用。'); } }).finally(() => { if (active) setBuildingsLoading(false); });
    return () => { active = false; };
  }, [prefs.campus]);
  useEffect(() => { avatarRef.current?.setState(avatarState); }, [avatarState]);

  const lastUser = useMemo(() => [...messages].reverse().find((message) => message.role === 'user') ?? null, [messages]);
  const chineseVoices = voices.filter((voice) => /^zh(?:-|_)/i.test(voice.locale)); const avatarCapabilities = avatarRef.current?.manifest.capabilities;
  function operationSnapshot(requestId: string) { return { sessionId: sessionRef.current, requestId, generation: generationRef.current }; }
  function operationIsCurrent(operation: ReturnType<typeof operationSnapshot>) { return isCurrentOperation(operation, { sessionId: sessionRef.current, requestId: requestRef.current, generation: generationRef.current }); }
  function emitClient(stage: 'speech' | 'avatar', status: 'started' | 'completed' | 'failed' | 'cancelled', operation: ReturnType<typeof operationSnapshot>, code?: 'not_implemented' | 'playback_failed' | 'permission_denied' | 'stopped') {
    if (!operationIsCurrent(operation)) return;
    void transport.clientEvent({ event_id: freshUuid(), request_id: operation.requestId, session_id: operation.sessionId, stage, status, duration_ms: null, data: code ? { code } : {} }).catch(() => undefined);
  }
  function trackAvatar(state: AvatarState, operation: ReturnType<typeof operationSnapshot>) {
    setAvatarState(state); if (!avatarReady) return;
    const status = state === 'error' ? 'failed' : state === 'idle' ? 'completed' : 'started'; queueMicrotask(() => emitClient('avatar', status, operation));
  }
  function startPolling(requestId: string, operation: ReturnType<typeof operationSnapshot>) {
    let cursor = 0; let stopped = false; let polling = false;
    const poll = async () => { if (stopped || polling || !operationIsCurrent(operation)) return; polling = true; try { const page = await transport.events(requestId, cursor); if (!operationIsCurrent(operation)) return; cursor = page.next_cursor; setTruncatedLogs((value) => value || page.truncated); setEvents((current) => mergeRuntimeEvents(current, page.events)); } catch (error) { const code = (error as Partial<ApiError>)?.error?.code; if (code !== 'not_found' && operationIsCurrent(operation)) setNotice('运行日志暂时无法读取。'); } finally { polling = false; } };
    void poll(); const timer = window.setInterval(() => void poll(), 500); const stop = () => { stopped = true; window.clearInterval(timer); }; pollStopRef.current = stop; return async () => { await poll(); stop(); };
  }
  async function executeActions(response: ChatResponse, operation: ReturnType<typeof operationSnapshot>) {
    const scene = new CampusCardSceneAdapter({
      focusBuilding: (id) => { const item = buildings.find((building) => building.id === id); if (!item) return false; setSelectedBuilding(item); document.getElementById(`building-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return true; },
      showBuildingCard: (id) => { const item = buildings.find((building) => building.id === id); if (!item) return false; setSelectedBuilding(item); return true; },
    });
    for (const action of response.actions) { if (!operationIsCurrent(operation)) return; const result = await scene.execute(action); if (!operationIsCurrent(operation)) return; await transport.ack({ request_id: response.request_id, session_id: response.session_id, action_id: action.action_id, status: result.status, ...(result.error_code ? { error_code: result.error_code } : {}) }).catch(() => setNotice('点位卡片已处理，但执行回执发送失败。')); }
  }
  async function speakText(requestId: string, text: string, operation: ReturnType<typeof operationSnapshot>) {
    if (!speechRef.current?.capabilities.tts) { setNotice('语音合成服务尚不可用，回答仍可阅读。'); return; }
    const voice = chineseVoices[0]; if (!voice) { setNotice('未检测到可用中文音色，已保留文字回答。'); return; }
    const utteranceId = freshUuid(); const controller = new AbortController();
    setSpeechBusy(true);
    const result = await speechRef.current.speak({ request_id: requestId, session_id: operation.sessionId, signal: controller.signal }, utteranceId, text, voice.id, {
      onText: () => undefined,
      onStart: (id) => { if (!operationIsCurrent(operation) || id !== utteranceId) return; setSpeechBusy(true); trackAvatar('speaking', operation); emitClient('speech', 'started', operation); },
      onEnd: (id) => { if (!operationIsCurrent(operation) || id !== utteranceId) return; setSpeechBusy(false); trackAvatar('idle', operation); emitClient('speech', 'completed', operation); },
      onFailure: (id, code) => { if (!operationIsCurrent(operation) || id !== utteranceId) return; setSpeechBusy(false); trackAvatar('idle', operation); emitClient('speech', 'failed', operation, code === 'permission_denied' ? 'permission_denied' : 'playback_failed'); setNotice(code === 'permission_denied' ? '语音播放权限被拒绝。' : '语音服务暂不可用，回答仍可阅读。'); },
    });
    if (operationIsCurrent(operation) && result.status !== 'ready') setSpeechBusy(false);
  }
  async function speakAnswer(response: ChatResponse, operation: ReturnType<typeof operationSnapshot>) {
    if (!prefs.autoSpeak) return;
    await speakText(response.request_id, response.answer, operation);
  }
  async function playMessage(message: DisplayMessage) {
    if (busy) { setNotice('请等待当前回答完成后再播放。'); return; }
    const operation = operationSnapshot(message.requestId);
    if (!operationIsCurrent(operation)) { setNotice('请播放当前请求的回答，旧请求不会重新进入播放队列。'); return; }
    await speakText(message.requestId, message.text, operation);
  }
  async function sendMessage(text = input, modeOverride?: Mode) {
    const clean = text.trim(); if (!clean || busy || composingRef.current) return;
    const requestId = freshUuid(requestRef.current ?? undefined); const controller = new AbortController(); requestRef.current = requestId; abortRef.current = controller; const operation = operationSnapshot(requestId);
    const userMessage: DisplayMessage = { id: freshUuid(), role: 'user', text: clean, requestId, status: 'done' }; const assistantId = freshUuid();
    setMessages((current) => [...current, userMessage, { id: assistantId, role: 'assistant', text: '', requestId, status: 'waiting' }]); setInput(''); setNotice(''); setBusy(true); trackAvatar('thinking', operation); const finishPolling = startPolling(requestId, operation);
    try {
      const response = await transport.chat({ request_id: requestId, session_id: operation.sessionId, message: clean, mode: modeOverride ?? mode, campus_id: prefs.campus, selected_building_id: selectedBuildingRef.current?.id ?? null }, controller.signal);
      if (!operationIsCurrent(operation)) return;
      if (!response.answer.trim()) throw { error: { code: 'empty_answer', message: '模型没有返回可显示的答案。', request_id: requestId, retryable: true } } satisfies ApiError;
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, text: response.answer, status: 'done', sources: response.sources, model: response.model, usage: response.usage, elapsedMs: response.elapsed_ms } : item));
      await executeActions(response, operation); if (operationIsCurrent(operation)) await speakAnswer(response, operation);
    } catch (error) {
      if (!operationIsCurrent(operation)) return; const cancelled = controller.signal.aborted || (error as Partial<ApiError>)?.error?.code === 'cancelled';
      setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, text: cancelled ? '本次请求已取消。' : errorMessage(error), status: cancelled ? 'cancelled' : 'error' } : item)); trackAvatar(cancelled ? 'idle' : 'error', operation);
    } finally { await finishPolling(); if (operationIsCurrent(operation)) { setBusy(false); abortRef.current = null; if (!speechBusy) trackAvatar('idle', operation); } }
  }
  async function stopCurrent() {
    const requestId = requestRef.current; if (!requestId) return; const sessionId = sessionRef.current; const operation = operationSnapshot(requestId); generationRef.current += 1; abortRef.current?.abort(); abortRef.current = null; pollStopRef.current?.(); pollStopRef.current = null;
    setBusy(false); setSpeechBusy(false); setAvatarState('idle'); setMessages((current) => current.map((item) => item.requestId === requestId && item.status === 'waiting' ? { ...item, text: '本次请求已取消。', status: 'cancelled' } : item));
    const stopped = await Promise.allSettled([speechRef.current?.stop(requestId), transport.cancel(requestId, sessionId), transport.speechStop(requestId, sessionId)]);
    if (stopped[0].status === 'fulfilled' && stopped[0].value?.local_stopped) {
      void transport.clientEvent({ event_id: freshUuid(), request_id: operation.requestId, session_id: operation.sessionId, stage: 'speech', status: 'cancelled', duration_ms: null, data: { code: 'stopped' } }).catch(() => undefined);
    }
  }
  async function clearConversation() {
    if (busy || speechBusy) await stopCurrent(); const previous = sessionRef.current; generationRef.current += 1; sessionRef.current = freshUuid(previous); requestRef.current = null;
    setMessages([]); setEvents([]); setTruncatedLogs(false); setNotice('已开始新会话。'); setSourcesOpenFor(null);
  }
  async function startListening() {
    const speech = speechRef.current; if (!speech || !speech.capabilities.asr) { setNotice('语音识别服务尚不可用，请继续使用文字输入。'); return; }
    const requestId = freshUuid(requestRef.current ?? undefined); requestRef.current = requestId; const controller = new AbortController(); abortRef.current = controller; const operation = operationSnapshot(requestId); setSpeechBusy(true); trackAvatar('listening', operation);
    try {
      const result = await speech.start({ request_id: requestId, session_id: operation.sessionId, signal: controller.signal }, {
        onText: (text, isFinal) => { if (!operationIsCurrent(operation)) return; setInput(text); if (isFinal) { setSpeechBusy(false); trackAvatar('idle', operation); emitClient('speech', 'completed', operation); setNotice('识别文字已填入，请确认后发送。'); } }, onStart: () => emitClient('speech', 'started', operation), onEnd: () => undefined,
        onFailure: (id, code) => { if (!operationIsCurrent(operation) || id !== requestId) return; setSpeechBusy(false); trackAvatar('idle', operation); emitClient('speech', 'failed', operation, code === 'permission_denied' ? 'permission_denied' : 'not_implemented'); setNotice(code === 'permission_denied' ? '麦克风权限被拒绝，请在浏览器设置中允许后重试。' : '语音识别服务暂不可用。'); },
      });
      if (operationIsCurrent(operation) && result.status !== 'ready') { setSpeechBusy(false); trackAvatar('idle', operation); }
    } catch { if (operationIsCurrent(operation)) { setSpeechBusy(false); trackAvatar('idle', operation); setNotice('无法启动语音识别，请检查麦克风权限或服务状态。'); } }
  }
  function introduceBuilding(building: Building) { selectedBuildingRef.current = building; setSelectedBuilding(building); setMode('campus_qa'); void sendMessage('请介绍这里。', 'campus_qa'); }
  function exportLogs() { const blob = new Blob([sanitizedLogExport(events)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `ai4tju-session-log-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); }
  const applicationTone = serviceError ? 'off' : health ? 'ready' : 'pending'; const modelTone = health?.model.verified ? 'ready' : health?.model.configured ? 'pending' : 'off';
  const hasRetry = lastUser && messages.some((message) => message.requestId === lastUser.requestId && (message.status === 'error' || message.status === 'cancelled'));

  return <div className="app-shell">
    <header className="topbar"><div className="brand"><span className="brand-mark">海</span><div><strong>珂莱塔</strong><span>天津大学数字人校园导游</span></div></div><div className="system-status" aria-label="系统状态"><StatusPill tone={applicationTone}>{serviceError ? '应用离线' : health ? '应用在线' : '连接中'}</StatusPill><StatusPill tone={modelTone}>{health?.model.verified ? '模型已连通' : health?.model.configured ? '模型待验证' : '模型未配置'}</StatusPill></div><div className="top-actions"><button className="icon-button" aria-label="打开显示设置" title="显示设置" onClick={() => setSettingsOpen((value) => !value)}><Icon name="settings"/></button><button className="logs-button" onClick={() => setLogsOpen(true)}><Icon name="logs"/><span>运行日志</span>{events.length > 0 && <b>{events.length}</b>}</button></div></header>
    {settingsOpen && <aside className="settings-popover" aria-label="显示设置"><div className="popover-heading"><div><strong>显示设置</strong><span>仅保存在本机</span></div><button className="icon-button" aria-label="关闭设置" onClick={() => setSettingsOpen(false)}><Icon name="close"/></button></div><label>人物缩放 <output>{Math.round(prefs.avatarScale * 100)}%</output><input type="range" min=".8" max="1.25" step=".05" value={prefs.avatarScale} onChange={(event) => setPrefs({ ...prefs, avatarScale: Number(event.target.value) })}/></label><fieldset><legend>舞台背景</legend><button className={prefs.backdrop === 'blueprint' ? 'selected' : ''} onClick={() => setPrefs({ ...prefs, backdrop: 'blueprint' })}>北洋蓝图</button><button className={prefs.backdrop === 'quiet' ? 'selected' : ''} onClick={() => setPrefs({ ...prefs, backdrop: 'quiet' })}>简洁背景</button></fieldset><div className="capability-note"><strong>外观定制</strong><span>{avatarCapabilities?.expressions.length || avatarCapabilities?.motions.length || avatarCapabilities?.face_morph ? '显示人物提供的真实变体' : '当前人物没有已验证的外观变体'}</span></div></aside>}
    <main className="workspace"><section className="guide-stage" aria-label="数字人导览区"><div className={`avatar-stage ${prefs.backdrop}`}><div className="stage-grid" aria-hidden="true"/><div className="campus-stamp"><span>AI4TJU</span><strong>{CAMPUS_NAMES[prefs.campus]}</strong></div><div className="avatar-host" ref={avatarHostRef} style={{ transform: `scale(${prefs.avatarScale})` }}/>{!avatarReady && <div className="avatar-fallback" role="status"><span className="fallback-monogram">海</span><strong>{avatarMessage}</strong><p>不会用替代人物冒充已提供形象</p></div>}<div className={`avatar-state ${avatarState}`}><span/><div><small>珂莱塔</small><strong>{AVATAR_LABELS[avatarState]}</strong></div></div></div>
      <section className="campus-panel"><div className="section-heading"><div><span className="kicker">CAMPUS GUIDE</span><h2>校园点位</h2></div><div className="campus-switch" role="group" aria-label="选择校区">{(Object.keys(CAMPUS_NAMES) as CampusId[]).map((campus) => <button key={campus} className={prefs.campus === campus ? 'active' : ''} onClick={() => setPrefs({ ...prefs, campus })}>{CAMPUS_NAMES[campus]}</button>)}</div></div>
        {buildingsLoading ? <div className="card-skeletons" aria-label="正在加载点位"><span/><span/><span/></div> : buildingNotice ? <div className="empty-card"><Icon name="pin"/><p>{buildingNotice}</p></div> : <div className="building-row">{buildings.map((building) => <article id={`building-${building.id}`} key={building.id} className={`building-card ${selectedBuilding?.id === building.id ? 'selected' : ''}`} onClick={() => setSelectedBuilding(building)}><div className="building-title"><span><Icon name="pin" size={16}/></span><div><small>{CAMPUS_NAMES[building.campus_id]}</small><h3>{building.title}</h3></div></div><p>{building.summary}</p><div className="card-actions"><button onClick={(event) => { event.stopPropagation(); setSelectedBuilding(building); }}>查看资料卡</button><button className="primary-small" disabled={busy} onClick={(event) => { event.stopPropagation(); introduceBuilding(building); }}>介绍这里</button></div></article>)}</div>}
        {selectedBuilding && <details className="building-detail" open><summary>{selectedBuilding.title} · 资料卡</summary><p>{selectedBuilding.summary}</p><div><span>资料获取：{new Date(selectedBuilding.retrieved_at).toLocaleDateString('zh-CN')}</span>{safeSourceUrl(selectedBuilding.url) && <a href={safeSourceUrl(selectedBuilding.url)!} target="_blank" rel="noreferrer">查看实际来源 ↗</a>}</div></details>}</section></section>
      <section className="conversation" aria-label="与珂莱塔对话"><div className="conversation-header"><div><span className="kicker">CONVERSATION</span><h2>问问珂莱塔</h2></div><button className="icon-button" aria-label="清空并开始新会话" title="清空并开始新会话" onClick={() => void clearConversation()}><Icon name="trash"/></button></div><div className="mode-tabs" role="tablist" aria-label="对话模式">{(Object.keys(MODE_LABELS) as Mode[]).map((item) => <button role="tab" aria-selected={mode === item} key={item} onClick={() => setMode(item)}>{MODE_LABELS[item]}</button>)}</div>
        <div className="message-list" aria-live="polite">{messages.length === 0 && <div className="conversation-empty"><span className="empty-seal">珂</span><h3>今天想从哪里逛起？</h3><p>可以问校园历史、建筑与到访信息，也可以让我帮你写一段校园内容。</p><div>{['北洋园有哪些已核实点位？', '介绍一下选中的建筑', '帮我写一段参观感想'].map((prompt) => <button key={prompt} onClick={() => setInput(prompt)}>{prompt}</button>)}</div></div>}
          {messages.map((message) => <div key={message.id} className={`message ${message.role} ${message.status}`}><div className="message-meta"><strong>{message.role === 'user' ? '你' : '珂莱塔'}</strong>{message.status === 'waiting' && <span>等待模型返回</span>}{message.status === 'cancelled' && <span>已取消</span>}{message.status === 'error' && <span>未完成</span>}</div>{message.status === 'waiting' ? <div className="waiting-answer"><span/><p>模型正在处理。当前接口为非流式，完整答案返回后会一次显示。</p></div> : <RichText text={message.text}/>} {message.role === 'assistant' && message.status === 'done' && <div className="answer-footer"><span>{message.model ?? '模型未返回'}</span><span>{message.elapsedMs != null ? `${message.elapsedMs} ms` : '耗时未返回'}</span><span>{message.usage ? `${message.usage.total_tokens} tokens` : '用量未返回'}</span>{message.requestId === requestRef.current && <button aria-label="播放这条回答" onClick={() => void playMessage(message)}><Icon name="volume" size={14}/> 播放</button>}{message.sources && message.sources.length > 0 && <button onClick={() => setSourcesOpenFor(sourcesOpenFor === message.id ? null : message.id)}>来源 {message.sources.length} 条 <span>{sourcesOpenFor === message.id ? '−' : '+'}</span></button>}</div>}{sourcesOpenFor === message.id && message.sources && <div className="source-list">{message.sources.map((source) => <article key={source.id}><div><span>{CAMPUS_NAMES[source.campus_id]}</span><time>{source.published_at ? new Date(source.published_at).toLocaleDateString('zh-CN') : '发布日期未提供'}</time></div><h4>{source.title}</h4><p>{source.snippet}</p>{safeSourceUrl(source.url) ? <a href={safeSourceUrl(source.url)!} target="_blank" rel="noreferrer">打开来源 ↗</a> : <span className="invalid-source">来源地址无效</span>}</article>)}</div>}</div>)}</div>
        <div className="composer-area">{selectedBuilding && <div className="context-chip"><Icon name="pin" size={14}/><span>当前点位：{selectedBuilding.title}</span><button aria-label="取消选择点位" onClick={() => setSelectedBuilding(null)}>×</button></div>}{notice && <p className="notice" role="status">{notice}</p>}<div className="composer"><textarea value={input} maxLength={8000} rows={3} placeholder={mode === 'content_generation' ? '告诉我你想生成什么校园内容…' : '输入你的问题…'} onChange={(event) => setInput(event.target.value)} onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={() => { composingRef.current = false; }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !composingRef.current) { event.preventDefault(); void sendMessage(); } }}/><div className="composer-footer"><div><button className={`icon-button ${speechBusy ? 'active' : ''}`} aria-label={speechBusy ? '停止语音识别' : '语音输入'} title="识别文字会先填入输入框" onClick={() => speechBusy ? void stopCurrent() : void startListening()}><Icon name="mic"/></button><label className="auto-speak"><input type="checkbox" checked={prefs.autoSpeak} onChange={(event) => setPrefs({ ...prefs, autoSpeak: event.target.checked })}/><Icon name="volume" size={16}/><span>自动播报</span></label></div>{busy || speechBusy ? <button className="stop-button" onClick={() => void stopCurrent()}><Icon name="stop"/>停止</button> : <button className="send-button" disabled={!input.trim()} onClick={() => void sendMessage()}><span>发送</span><Icon name="send"/></button>}</div></div>{hasRetry && <button className="retry-button" onClick={() => void sendMessage(lastUser!.text)}><Icon name="retry" size={16}/>使用新请求重试</button>}<p className="composer-hint">Enter 发送 · Shift + Enter 换行 · 对话不会默认保存到本机</p></div></section></main>
    <div className={`drawer-backdrop ${logsOpen ? 'open' : ''}`} onClick={() => setLogsOpen(false)}/><aside className={`log-drawer ${logsOpen ? 'open' : ''}`} aria-hidden={!logsOpen} aria-label="当前会话运行日志"><div className="drawer-header"><div><span className="kicker">RUNTIME EVENTS</span><h2>当前会话日志</h2></div><button className="icon-button" aria-label="关闭日志" onClick={() => setLogsOpen(false)}><Icon name="close"/></button></div><div className="drawer-tools"><p>仅显示后端与浏览器实际返回的事件。</p><button disabled={!events.length} onClick={exportLogs}><Icon name="download" size={16}/>脱敏导出</button></div>{truncatedLogs && <div className="log-warning">早期日志已由服务端淘汰。</div>}<div className="log-list">{events.length === 0 ? <div className="logs-empty"><Icon name="logs" size={24}/><p>当前会话还没有运行事件。</p></div> : events.map((event) => <article key={`${event.origin}:${event.event_id}`}><div className="log-rail"><span className={event.status}/><i/></div><div className="log-body"><div><strong>{event.origin === 'backend' ? '后端' : '浏览器'} · {event.stage}</strong><time>{new Date(event.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}</time></div><p>{event.status}{event.data.code ? ` · ${event.data.code}` : ''}{event.data.count != null ? ` · ${event.data.count} 项` : ''}</p><span>{event.duration_ms == null ? '耗时未返回' : `${event.duration_ms} ms`}</span></div></article>)}</div></aside>
  </div>;
}
