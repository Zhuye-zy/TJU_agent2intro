import {useEffect,useRef,useState} from 'react';
import type {AvatarAdapter} from '../../../shared/contracts';
import {guideTrace,type NarrationSnapshot} from './narration-session';
import {tourPhotoFor} from './tour-photos';

export function GuidePresentation({session,avatar,onPause,onResume,onStop}:{session:NarrationSnapshot;avatar:AvatarAdapter|null;onPause():void;onResume():void;onStop():void}){
  const videoRef=useRef<HTMLVideoElement>(null),hostRef=useRef<HTMLDivElement>(null);
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false),[blocked,setBlocked]=useState(false),[collapsed,setCollapsed]=useState(false),[expanded,setExpanded]=useState(false);
  const [imageFailed,setImageFailed]=useState(false);
  const active=!['stopped','ended'].includes(session.status);
  const photo=tourPhotoFor(session.poi.id,session.poi.name);
  useEffect(()=>{setReady(false);setFailed(false);setBlocked(false);},[session.id,session.video?.src]);
  useEffect(()=>{
    if(!active||collapsed)return;
    avatar?.setPresentationHost?.(hostRef.current);
    return()=>avatar?.setPresentationHost?.(null);
  },[avatar,session.id,active,collapsed]);
  useEffect(()=>{
    const video=videoRef.current;if(!video)return;
    let live=true;
    if(session.status==='playing'&&ready&&!collapsed&&!failed){
      guideTrace('video.play_request',{id:session.id,time:video.currentTime});
      void video.play().then(()=>{if(!live)video.pause();else setBlocked(false);}).catch(error=>{
        if(!live)return;
        if(error.name==='NotAllowedError')setBlocked(true);else setFailed(true);
        guideTrace('video.error',{id:session.id,code:error.name});
      });
    }else video.pause();
    return()=>{live=false;video.pause();};
  },[session.id,session.status,ready,collapsed,failed]);
  useEffect(()=>{
    if(!session.video||ready||failed||!active)return;
    const timer=setTimeout(()=>{setFailed(true);guideTrace('video.timeout',{id:session.id});},8000);
    return()=>clearTimeout(timer);
  },[session.id,session.video,ready,failed,active]);
  const title=({preparing:'正在准备讲解',buffering:'正在准备下一段',playing:'海小棠正在讲解',paused:'讲解已暂停',ended:'讲解结束',stopped:'讲解已停止',error:'声音暂未播放'})[session.status];
  return <section className={'guide-presentation'+(expanded?' expanded':'')+(!avatar?.setPresentationHost?' adjacent':'')} data-narration-id={session.id} data-narration-status={session.status} aria-label="地点讲解">
    <header><div><small>{title}</small><strong>{session.poi.name}</strong></div><button type="button" onClick={()=>setCollapsed(!collapsed)}>{collapsed?'展开画面':'收起画面'}</button></header>
    <div className="narration-stage" ref={hostRef} hidden={collapsed}>
      <div className="narration-visual">
        {session.video&&!failed?<video key={session.id+session.video.src} ref={videoRef} src={session.video.src} poster={photo.placeholder?undefined:photo.src} muted loop playsInline preload="auto"
          onCanPlay={()=>setReady(true)} onPlaying={()=>guideTrace('video.playing',{id:session.id,time:videoRef.current?.currentTime})}
          onPause={()=>guideTrace('video.pause',{id:session.id,time:videoRef.current?.currentTime})}
          onError={()=>{setFailed(true);guideTrace('video.failed',{id:session.id});}}/>
          :!photo.placeholder&&!imageFailed?<img src={photo.src} alt={photo.caption} onError={()=>setImageFailed(true)}/>:<div className="place-cover"><span>海小棠 · 校园漫游</span><strong>{session.poi.name}</strong><small>地点资料</small></div>}
        <span className="media-caption">{session.video&&!failed?(ready?(session.video.kind==='photo_film'?'实景照片导览片 · 非实拍视频':'讲解配片 · 静音'):'正在载入配片 · 讲解继续'):photo.placeholder||imageFailed?'图文讲解':'照片导览'}</span>
        <button className="media-expand" onClick={()=>setExpanded(!expanded)} aria-label={expanded?'还原画面':'放大画面'}>{expanded?'还原':'放大'}</button>
      </div>
    </div>
    {session.caption&&<p className="narration-subtitle" aria-live="off">{session.caption}</p>}
    <div className="narration-controls">
      {['paused','error'].includes(session.status)?<button onClick={onResume}>继续讲解</button>:active&&<button onClick={onPause}>暂停讲解</button>}
      {active&&<button onClick={onStop}>停止讲解</button>}
      {blocked&&<button onClick={()=>{void videoRef.current?.play().then(()=>setBlocked(false)).catch(()=>setFailed(true));}}>继续播放画面</button>}
      {failed&&<span role="status">配片暂时无法播放，继续为你讲解。</span>}
      {session.error&&<span role="status">{session.error}</span>}
    </div>
  </section>;
}
