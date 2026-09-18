// Real Chrome/backend/TTS. Explicit fault injection only in named media cases.
import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root='docs/interaction/20260918-ui-sync',results=[];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+path.resolve('.runtime/intro-synthetic.wav')]});
const media='/api/knowledge/videos/file/beiyangyuan-zhengdong-library-1.mp4';
async function page(){const p=await browser.newPage({viewport:{width:1366,height:768}});await p.addInitScript(()=>localStorage.setItem('ai4tju.r2.preferences',JSON.stringify({campus:'beiyangyuan'})));await p.goto('http://127.0.0.1:8000');await p.getByRole('combobox',{name:'当前介绍地点'}).selectOption('beiyangyuan-zhengdong-library');return p;}
async function start(p){await p.locator('.poi-actions button').first().click();await p.waitForFunction(()=>document.querySelector('.guide-presentation')?.dataset.narrationStatus==='playing',null,{timeout:40000});}
async function check(name,fn){try{results.push({name,pass:true,...await fn()});console.log('PASS '+name);}catch(e){results.push({name,pass:false,error:String(e)});console.log('FAIL '+name+' '+e.message);}}
try{
 await check('real missing clip uses matching photo while real TTS plays',async()=>{
  const p=await page();try{await p.getByRole('combobox',{name:'当前介绍地点'}).selectOption('beiyangyuan-datong-center');await start(p);assert.equal(await p.locator('.narration-visual video').count(),0);assert.equal(await p.locator('.narration-visual img,.narration-visual .place-cover').count(),1);await p.locator('.guide-presentation').screenshot({path:root+'/missing-media-fallback.png'});return {layer:'real API returns no media; real TTS'};}finally{await p.close();}
 });
 await check('404 clip falls back without interrupting real TTS',async()=>{
  const p=await page();try{await p.route('**'+media,r=>r.fulfill({status:404,body:'missing'}));await start(p);await p.locator('.narration-controls').getByText('配片暂时无法播放，继续为你讲解。').waitFor();assert.equal(await p.locator('.narration-visual video').count(),0);return {layer:'injected HTTP 404, real remaining services'};}finally{await p.close();}
 });
 await check('slow video buffer ends loading in 8 seconds and ignores late completion',async()=>{
  const p=await page();try{await p.route('**'+media,async r=>{await new Promise(x=>setTimeout(x,10500));await r.continue().catch(()=>{});});await start(p);await p.locator('.narration-controls').getByText('配片暂时无法播放，继续为你讲解。').waitFor({timeout:11000});assert.equal(await p.locator('.narration-visual video').count(),0);await p.waitForTimeout(2800);assert.equal(await p.locator('.narration-visual video').count(),0);return {layer:'injected 10.5 second video response delay'};}finally{await p.close();}
 });
 await check('rapid switch cannot let late media overwrite the second place',async()=>{
  const p=await page();try{
   await p.route('**/api/knowledge/videos/search?**',async r=>{if(r.request().url().includes('zhengdong-library')){await new Promise(x=>setTimeout(x,2500));await r.fulfill({json:{video:{poi_id:'beiyangyuan-zhengdong-library',campus_id:'beiyangyuan',src:media}}}).catch(()=>{});}else await r.continue();});
   await p.locator('.poi-actions button').first().click();await p.locator('.guide-presentation').waitFor();
   await p.getByRole('combobox',{name:'当前介绍地点'}).selectOption('beiyangyuan-datong-center');await start(p);
   await p.waitForTimeout(3000);assert.equal(await p.locator('.poi-card').getAttribute('data-poi-id'),'beiyangyuan-datong-center');assert.equal(await p.locator('.narration-visual video').count(),0);
   const traces=await p.evaluate(()=>window.__guideTrace);return {layer:'delayed old metadata, actual new TTS',traces};
  }finally{await p.close();}
 });
 await check('collapsing and expanding keeps one video and its current time',async()=>{
  const p=await page();try{await start(p);await p.waitForFunction(()=>document.querySelector('.narration-visual video')?.currentTime>.1);const before=await p.locator('.narration-visual video').evaluate(v=>v.currentTime);await p.getByRole('button',{name:'收起画面',exact:true}).click();assert.equal(await p.locator('video[src]').count(),1);await p.waitForTimeout(300);await p.getByRole('button',{name:'展开画面',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('.narration-visual video')?.paused);const after=await p.locator('.narration-visual video').evaluate(v=>v.currentTime);assert.ok(after>=before);return {before,after};}finally{await p.close();}
 });
 await check('synthetic Mandarin travels through Chrome recorder, real ASR, confirmation and same introduction session',async()=>{
  const p=await page();try{
   await p.locator('.open-guide').click();await p.getByRole('button',{name:'语音输入',exact:true}).click();await p.getByRole('button',{name:'停止录音并识别',exact:true}).waitFor();await p.waitForTimeout(4800);await p.getByRole('button',{name:'停止录音并识别',exact:true}).click();
   const input=p.getByRole('textbox',{name:'对导游说',exact:true});await p.waitForFunction(()=>document.querySelector('textarea[aria-label="对导游说"]')?.value.includes('介绍'),null,{timeout:70000});const recognized=await input.inputValue();assert.match(recognized,/介绍.*这里/);
   await p.getByRole('button',{name:'发送',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.narration-visual video')?.paused===false,null,{timeout:40000});
   await p.screenshot({path:root+'/synthetic-voice-flow.png',fullPage:true});return {recognized,layer:'Chrome fake capture of TTS WAV → MediaRecorder → real faster-whisper CPU → confirmed UI send → real TTS/video. No human microphone or speaker-acoustic claim.'};
  }finally{await p.close();}
 });
}finally{await fs.writeFile(root+'/edge-case-report.json',JSON.stringify({browser:await browser.version(),results},null,2));await browser.close();}
if(results.some(r=>!r.pass))process.exitCode=1;
