// Additive B -> A local callback contract; never a model request or runtime text log.
import type {SpeechInteractionEvent} from './r3';
export interface SpeechInteractionContext {
 interaction_id:string; session_id:string; campus_id:'weijinlu'|'beiyangyuan';
 generation_id:string; request_id:string|null;
}
export interface SpeechInteractionOptions {
 context:SpeechInteractionContext;
 mode:'push_to_talk'|'continuous';
 onEvent:(event:SpeechInteractionEvent)=>void;
 onAudioLevel?:(level:number)=>void; // Actual playback RMS only; stopped/silent = 0.
}
export interface SpeechInteractionController {
 start(options:SpeechInteractionOptions):Promise<{status:'started'|'unavailable';error_code?:string}>;
 stop(reason:'user'|'campus_changed'|'disposed'):Promise<void>;
 dispose():void;
}
// B exports createSpeechInteractionController() from frontend/src/speech/interaction.ts.
// Existing createSpeechController and AvatarAdapter remain compatible.
// B adds setAudioLevel?(level:number):void to its avatar adapter, RMS 0..1, silence=0.
// A forwards B's local audio level callback; waveform levels are never runtime logs.