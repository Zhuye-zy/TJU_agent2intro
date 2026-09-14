from fastapi import APIRouter, Response
from backend.contracts import AsrRequest, AsrResponse, TtsRequest, TtsResponse, VoiceList
from .service import speech
router = APIRouter(prefix="/api/speech", tags=["speech"])
@router.get("/voices", response_model=VoiceList)
async def voices():
    available = await speech.list_voices()
    return VoiceList(voices=available, status="ready" if available else "not_implemented")
@router.post("/asr", response_model=AsrResponse)
async def asr(request: AsrRequest):
    return await speech.transcribe(request)
@router.post("/tts", response_model=TtsResponse)
async def tts(request: TtsRequest):
    return await speech.synthesize(request)

@router.get("/audio/{token}", response_class=Response)
async def audio(token: str):
    content, mime_type = speech.take_audio(token)
    return Response(content=content, media_type=mime_type, headers={"Cache-Control": "no-store"})

from backend.contracts import SpeechContext, SpeechStopResponse
@router.post('/stop', response_model=SpeechStopResponse)
async def stop(body: SpeechContext):
    return await speech.stop(body)
