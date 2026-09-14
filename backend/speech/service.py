"""B-owned. Dependencies ready; no provider network calls in M0."""
from typing import Protocol
import edge_tts
from openai import AsyncOpenAI
from backend.contracts import AsrRequest, AsrResponse, TtsRequest, TtsResponse, Voice
from backend.common.errors import DomainError
class SpeechProvider(Protocol):
    async def transcribe(self, request: AsrRequest) -> AsrResponse: ...
    async def synthesize(self, request: TtsRequest) -> TtsResponse: ...
    async def list_voices(self) -> list[Voice]: ...
def prepare_edge_tts(text: str, voice: str) -> edge_tts.Communicate:
    # Construction only; B implements async stream, local file lifecycle and cancellation.
    return edge_tts.Communicate(text, voice)
def prepare_asr_client(url: str, key: str) -> AsyncOpenAI:
    # B chooses configured OpenAI-compatible ASR service; never borrows campus GLM key.
    return AsyncOpenAI(base_url=url, api_key=key, timeout=30, max_retries=0)
class UnimplementedSpeech:
    async def transcribe(self, request: AsrRequest) -> AsrResponse:
        raise DomainError("not_implemented", "M0 ASR 尚未实现", 501, request.request_id)
    async def synthesize(self, request: TtsRequest) -> TtsResponse:
        raise DomainError("not_implemented", "M0 TTS 尚未实现", 501, request.request_id)
    async def list_voices(self) -> list[Voice]:
        return []
speech: SpeechProvider = UnimplementedSpeech()
