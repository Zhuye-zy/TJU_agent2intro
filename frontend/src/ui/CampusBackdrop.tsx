import { useEffect, useRef, useState } from 'react';
import type { CampusId } from '../../../shared/contracts';
import type { CampusAssets, CampusMedia } from '../../../shared/r2';
import { safeSourceUrl } from './model';
import { campusMediaFor } from './r2-model';

interface Props { campus: CampusId; assets: CampusAssets | null; children: React.ReactNode }

export function CampusBackdrop({ campus, assets, children }: Props) {
  const [layers, setLayers] = useState<[CampusMedia | null, CampusMedia | null]>([null, null]);
  const [active, setActive] = useState<0 | 1>(0); const [missing, setMissing] = useState(true); const generationRef = useRef(0); const activeRef = useRef<0 | 1>(0);
  useEffect(() => {
    const generation = ++generationRef.current; const target = campusMediaFor(assets, campus);
    if (!target) { setMissing(true); setLayers([null, null]); return; }
    const image = new Image(); image.onload = () => {
      if (generationRef.current !== generation) return; const next = activeRef.current === 0 ? 1 : 0;
      setLayers((current) => { const copy: [CampusMedia | null, CampusMedia | null] = [...current]; copy[next] = target; return copy; });
      requestAnimationFrame(() => { if (generationRef.current === generation) { activeRef.current = next; setActive(next); setMissing(false); } });
    };
    image.onerror = () => { if (generationRef.current === generation) { setMissing(true); setLayers([null, null]); } };
    image.src = target.local_path;
    return () => { image.onload = null; image.onerror = null; };
  }, [campus, assets]);
  const visible = layers[active]; const sourceUrl = visible ? safeSourceUrl(visible.source_url) : null;
  return <div className={`campus-backdrop ${missing ? 'missing' : ''}`}>
    {layers.map((media, index) => <div key={index} className={`campus-photo-layer ${active === index && media ? 'active' : ''}`} style={media ? { backgroundImage: `linear-gradient(180deg,rgba(4,24,45,.12),rgba(4,24,45,.7)),url("${media.local_path.replace(/["\\]/g, '')}")`, backgroundPosition: `${media.focal_point[0] * 100}% ${media.focal_point[1] * 100}%` } : undefined}/>) }
    {children}
    <div className="photo-credit">{visible && !missing ? <>{visible.caption} · {visible.creator ?? '作者未署名'} · {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer">图源</a> : '图源地址不可用'}</> : <>当前校区暂无可用实景照片 · 使用中性背景</>}</div>
  </div>;
}
