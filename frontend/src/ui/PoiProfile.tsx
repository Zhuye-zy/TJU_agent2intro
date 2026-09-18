import { useEffect, useState } from 'react';
import type { POI } from '../../../shared/r2';
import type { TourKnowledgeContext } from '../../../shared/r3-knowledge';
import { tourKnowledgeContext } from '../transport/r3-knowledge';
import { tourPhotoFor } from './tour-photos';
import { safeSourceUrl } from './model';
import {guideTrace} from './narration-session';

/** A place's introduction stays available even when additional material is offline. */
export function PoiProfile({poi, categoryLabel}: {poi: POI; categoryLabel: string}) {
  const [context, setContext] = useState<TourKnowledgeContext | null>(null);
  const [expanded,setExpanded]=useState(false),[imageFailed,setImageFailed]=useState(false);
  const photo = tourPhotoFor(poi.id, poi.name);
  const aliases = poi.aliases.filter(alias => alias !== poi.name);
  useEffect(() => {
    const controller = new AbortController();
    guideTrace('card.visible',{poi:poi.id,campus:poi.campus_id});
    setExpanded(false);setImageFailed(false);
    setContext(null);
    void tourKnowledgeContext(poi.id, poi.campus_id, undefined, controller.signal)
      .then(value => { if (!controller.signal.aborted) setContext(value); }).catch(() => undefined);
    return () => controller.abort();
  }, [poi.id, poi.campus_id]);
  const stories = (context?.evidence ?? []).filter(item =>
    item.poi_id === poi.id && item.campus_id === poi.campus_id &&
    ['stable_fact', 'historical_event'].includes(item.claim_type) &&
    item.evidence.relation === 'supports' &&
    ['verified', 'historical'].includes(item.evidence.verification) &&
    item.current_status !== 'conflict' && item.evidence.claim !== poi.description
  ).filter((item, index, all) => all.findIndex(other => other.evidence.claim === item.evidence.claim) === index).slice(0, 3);
  return <div className="poi-profile">
    <figure>{!photo.placeholder&&!imageFailed?<><img src={photo.src} alt={photo.caption} loading="lazy" onError={()=>setImageFailed(true)}/><figcaption>{photo.caption}</figcaption></>:<div className="place-cover"><span>海小棠 · 校园漫游</span><strong>{poi.name}</strong><small>{categoryLabel} · 地点资料</small></div>}</figure>
    <div className="poi-profile-copy"><span className="poi-profile-kicker">{poi.campus_id === 'weijinlu' ? '卫津路校区' : '北洋园校区'} · {categoryLabel}</span>
      <h3>{poi.name}</h3><p className="poi-profile-intro">{!expanded&&poi.description.length>160?poi.description.slice(0,160)+'…':poi.description}</p>
      {aliases.length > 0 && <p className="poi-profile-aliases">也称：{aliases.join('、')}</p>}
      {stories.length > 0 && <section className="poi-profile-stories"><h4>认识这里</h4>{(expanded?stories:stories.slice(0,1)).map(item => {
        const href = safeSourceUrl(item.source_url ?? '');
        return <p key={item.evidence.evidence_id}>{item.evidence.claim.replace(/（适用日期未提供）/g,'')}{href && <> <a href={href} target="_blank" rel="noreferrer">资料来源 ↗</a></>}</p>;
      })}</section>}
      {(stories.length>1||poi.description.length>160)&&<button type="button" className="expand-intro" onClick={()=>setExpanded(!expanded)}>{expanded?'收起介绍':'展开介绍'}</button>}
    </div>
  </div>;
}
