import { useEffect, useRef, useState } from 'react';
import type { Health, KnowledgeStatus, RuntimeEvent, ApiError } from '../../../shared/contracts';
import { transport } from '../transport/api';
import { StubAvatarAdapter } from '../avatar/adapter';
import { StubSpeechAdapter } from '../speech/adapter';
import './style.css';
export function App() {
  const [health,setHealth] = useState<Health|null>(null);
  const [knowledge,setKnowledge] = useState<KnowledgeStatus|null>(null);
  const [notice,setNotice] = useState('');
  const [events,setEvents] = useState<RuntimeEvent[]>([]);
  const [busy,setBusy] = useState(false);
  const session = useRef(crypto.randomUUID());
  useEffect(()=>{ Promise.all([transport.health(),transport.knowledgeStatus()])
    .then(([h,k])=>{setHealth(h);setKnowledge(k);}).catch(()=>setNotice('后端连接失败，请检查本机服务。'));
    const avatar = new StubAvatarAdapter(); const speech = new StubSpeechAdapter();
    void avatar; void speech; // composition boundary reserved for M1; no fake character displayed
  },[]);
  async function probe() {
    setBusy(true);
    const request_id = crypto.randomUUID();
    try { await transport.chat({request_id,session_id:session.current,message:'M0 接口连通检查',mode:'general_chat',campus_id:'weijinlu',selected_building_id:null}); }
    catch(error) { setNotice((error as ApiError).error?.message ?? '连接失败'); }
    finally {
      try { setEvents((await transport.events(request_id)).events.slice(-500)); } catch { setEvents([]); }
      setBusy(false);
    }
  }
  return <main>
    <header><span className="mark">海</span><div><p className="eyebrow">AI4TJU · LOCAL DEVELOPMENT</p><h1>海小棠 · 校园导游</h1></div><span className="badge">M0 接口骨架</span></header>
    <section className="intro"><p>从这里，认识天大。</p><h2>数字人导游工作台，<br/>正在等待各模块接入。</h2><p className="muted">本页用于检查工程与接口。正式界面、人物、真实对话和校园资料由并行窗口实现。</p></section>
    <section className="grid">
      <article><span className="label">应用服务</span><h3>{health?'已在线':'连接中'}</h3><p>契约 {health?.contract_version ?? '—'}</p></article>
      <article><span className="label">指定模型</span><h3>{health?.model.configured?'已配置 · 未验证':'未配置 · 未验证'}</h3><p>真实调用尚未接入</p></article>
      <article><span className="label">首版形象</span><h3>kelaita · Live2D</h3><p>资源已确定，renderer 尚未实现</p></article>
      <article><span className="label">校园知识</span><h3>{knowledge?.document_count ?? '—'} 条资料</h3><p>{knowledge?.status==='unavailable'?'尚未导入真实数据':'等待状态'}</p></article>
    </section>
    <section className="panel"><div><h3>接口连通检查</h3><p>发送本地 stub 请求，预期返回“未实现”。不会调用模型。</p></div><button disabled={busy} onClick={()=>void probe()}>{busy?'检查中…':'检查接口'}</button>
    <p role="status">{notice}</p><ol>{events.map(e=><li key={e.origin+e.event_id}><time>{new Date(e.timestamp).toLocaleTimeString()}</time> {e.stage} · {e.status} {e.data.code ?? ''}</li>)}</ol></section>
    <footer>localhost 开发环境 · 语音、三维场景、捏脸与精确口型均未验证</footer>
  </main>;
}
