import { useCallback, useRef, useState } from 'react';
import type { CampusId } from '../../../shared/contracts';
import type { SceneIdentifyResponse } from '../../../shared/r2';
import { r2Transport } from '../transport/r2';
import { freshUuid } from './model';
import { preparePhoto, recognizeScene } from './ocr';

type Phase = 'idle' | 'preparing' | 'recognizing' | 'matching' | 'done' | 'error';

const PHASE_LABELS: Record<Phase, string> = {
  idle: '拍照识景',
  preparing: '处理照片…',
  recognizing: '识别文字…',
  matching: '生成讲解…',
  done: '拍照识景',
  error: '拍照识景',
};

export function SceneCamera({ campus, onSpeak }: { campus: CampusId; onSpeak: (text: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [result, setResult] = useState<SceneIdentifyResponse | null>(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');

  const identify = useCallback(async (text: string, poiId: string | null) => {
    setPhase('matching');
    try {
      const response = await r2Transport.visionIdentify({
        request_id: freshUuid(), session_id: freshUuid(), campus_id: campus,
        ocr_text: text, poi_id: poiId,
      });
      setResult(response);
      setPhase('done');
    } catch (thrown) {
      const code = (thrown as { error?: { code?: string } })?.error?.code;
      setError(code === 'TRANSPORT_TIMEOUT' ? '讲解生成超时，请重试或换一张照片。' : '识别请求失败，请稍后重试。');
      setPhase('error');
    }
  }, [campus]);

  const onFile = useCallback(async (file: File) => {
    setError(''); setResult(null); setOcrText(''); setProgress(0);
    setPhase('preparing');
    try {
      const { blobs, preview: thumbnail } = await preparePhoto(file);
      setPreview(thumbnail);
      setPhase('recognizing');
      const text = await recognizeScene(blobs, setProgress);
      setOcrText(text);
      if (!text) {
        setError('照片里没有识别到地名文字；可输入眼前建筑名，或靠近门牌再拍一张。');
        setPhase('error');
        return;
      }
      await identify(text.slice(0, 800), null);
    } catch {
      setError('本机文字识别未能完成；可直接输入眼前建筑名继续。');
      setPhase('error');
    }
  }, [identify]);

  const busy = phase === 'preparing' || phase === 'recognizing' || phase === 'matching';
  const label = phase === 'recognizing' && progress > 0 ? `识别文字 ${Math.round(progress * 100)}%` : PHASE_LABELS[phase];

  return <>
    <div className="scene-camera">
      <button type="button" className="scene-button" disabled={busy} title="拍下校园景物，结合本机文字识别与模型讲解" onClick={() => inputRef.current?.click()}>{label}</button>
      {preview && <img className="scene-preview" src={preview} alt="现场照片预览" />}
      {busy && <span className="scene-hint" role="status">{phase === 'matching' ? '正在调用 glm-5.1 生成实景讲解…' : '照片不出本机，仅上传识别到的文字。'}</span>}
      {phase === 'error' && error && <span className="scene-hint error" role="alert">{error}</span>}
    </div>
    {(phase === 'error' || (result && result.status !== 'matched')) && <form className="scene-manual" onSubmit={(event) => { event.preventDefault(); const value = manual.trim(); if (value && !busy) void identify(value, null); }}>
      <input value={manual} maxLength={60} placeholder="输入建筑名，如 第九教学楼" aria-label="手动输入地点名称" onChange={(event) => setManual(event.target.value)}/>
      <button type="submit" disabled={busy || !manual.trim()}>生成讲解</button>
    </form>}
    {result && <section className="scene-card" aria-label="拍照识景结果">
      <header>
        <strong>{result.poi ? result.poi.name : '未确认地点'}</strong>
        <span>{result.status === 'matched' ? `识别成功${result.model ? ` · ${result.model}` : ''}` : result.status === 'candidates' ? '请确认是哪里' : '未匹配到地点'}</span>
        <button type="button" aria-label="关闭识景结果" onClick={() => { setResult(null); setPhase('idle'); }}>×</button>
      </header>
      {result.poi && <p className="scene-narration">{result.narration}</p>}
      {result.status !== 'matched' && <div className="scene-candidates">{result.candidates.map((candidate) => <button key={candidate.id} type="button" onClick={() => void identify(result.ocr_text, candidate.id)}>{candidate.name}<small>{candidate.reason}</small></button>)}</div>}
      {result.status === 'not_found' && <p className="scene-narration">没找到对应地点，可以换角度重拍，或直接问我想了解哪座建筑。</p>}
      <footer>
        {result.poi && <button type="button" onClick={() => onSpeak(result.narration)}>朗读讲解</button>}
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}>再拍一张</button>
        {result.usage && <span>本次讲解 {result.usage.total_tokens} tokens</span>}
      </footer>
      {ocrText && <details><summary>照片识别的文字</summary><p>{ocrText}</p></details>}
    </section>}
    <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void onFile(file); }} />
  </>;
}
