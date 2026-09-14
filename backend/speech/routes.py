from fastapi import APIRouter
from backend.contracts import AsrRequest, AsrResponse, TtsRequest, TtsResponse, VoiceList
from .service import speech
router = APIRouter(prefix="/api/speech", tags=["speech"])
@router.get("/voices", response_model=VoiceList)
async def voices():
    return VoiceList(voices=await speech.list_voices(), status="not_implemented")
@router.post("/asr", response_model=AsrResponse)
async def asr(request: AsrRequest):
    return await speech.transcribe(request)
@router.post("/tts", response_model=TtsResponse)
async def tts(request: TtsRequest):
    return await speech.synthesize(request)

from backend.contracts import SpeechContext, SpeechStopResponse
@router.post('/stop', response_model=SpeechStopResponse)
async def stop(body: SpeechContext):
    return SpeechStopResponse(request_id=body.request_id, local_stopped=True, upstream_stop='not_started')
