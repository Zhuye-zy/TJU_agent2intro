// B-owned implementation point; explicit stub, existing speech adapter still works.
import type { SpeechController } from '../../../shared/r2';
const unavailable=async()=>({status:'not_implemented' as const,error_code:'not_implemented'});
export function createSpeechController():SpeechController {
 return {capabilities:{incremental:false,pause:false,resume:false,timestamps:'none'},
 enable:unavailable,begin:unavailable,append(){},finish:async()=>{},
 playSegment:unavailable,playFull:unavailable,stop:async()=>{},pause:unavailable,resume:unavailable,
 listVoices:async()=>[],subscribe:()=>()=>{},dispose(){}};
}
