import asyncio
import base64
from io import BytesIO
from pathlib import Path
from uuid import uuid4
import wave

import pytest

from backend.common.config import Settings
from backend.common.errors import DomainError
from backend.contracts import AsrRequest, SpeechContext, TtsRequest
from backend.speech.service import CampusSpeechService, decode_pcm16_wav


def pcm16_wav(seconds: float = 0.1, sample_rate: int = 16000, channels: int = 1) -> bytes:
    output = BytesIO()
    with wave.open(output, "wb") as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(b"\0\0" * int(seconds * sample_rate) * channels)
    return output.getvalue()


def asr_request(data: bytes) -> AsrRequest:
    return AsrRequest(
        request_id=uuid4(),
        session_id=uuid4(),
        audio={
            "encoding": "base64",
            "mime_type": "audio/wav",
            "sample_rate_hz": 16000,
            "channels": 1,
            "audio_base64": base64.b64encode(data).decode("ascii"),
        },
    )


def settings(**updates) -> Settings:
    values = {
        "asr_url": "",
        "asr_model": "",
        "asr_api_key": "",
        "tts_provider": "edge",
        "tts_voice": "zh-CN-XiaoxiaoNeural",
    }
    values.update(updates)
    return Settings(**values)


def test_pcm16_wav_validation_rejects_wrong_rate_and_malformed_data():
    assert decode_pcm16_wav(asr_request(pcm16_wav())).startswith(b"RIFF")
    with pytest.raises(DomainError) as wrong_rate:
        decode_pcm16_wav(asr_request(pcm16_wav(sample_rate=8000)))
    assert wrong_rate.value.code == "invalid_audio"
    with pytest.raises(DomainError) as malformed:
        decode_pcm16_wav(asr_request(b"not-a-wave"))
    assert malformed.value.code == "invalid_audio"
    with pytest.raises(DomainError) as truncated:
        decode_pcm16_wav(asr_request(pcm16_wav()[:-8]))
    assert truncated.value.code == "invalid_audio"


def test_unconfigured_asr_has_explicit_error(tmp_path: Path):
    async def run():
        service = CampusSpeechService(settings(), tmp_path)
        request = asr_request(pcm16_wav())
        with pytest.raises(DomainError) as caught:
            await service.transcribe(request)
        assert caught.value.code == "asr_not_configured"
        assert caught.value.status == 503

    asyncio.run(run())


def test_tts_audio_is_bounded_to_local_one_shot_url(monkeypatch, tmp_path: Path):
    class FakeCommunicate:
        async def save(self, target: str):
            Path(target).write_bytes(b"ID3\x04\x00\x00test-audio")

    monkeypatch.setattr("backend.speech.service.prepare_edge_tts", lambda text, voice: FakeCommunicate())

    async def run():
        service = CampusSpeechService(settings(), tmp_path)
        request = TtsRequest(
            request_id=uuid4(),
            session_id=uuid4(),
            utterance_id=uuid4(),
            text="你好，欢迎来到天津大学。",
            voice_id="edge:zh-CN-XiaoxiaoNeural",
        )
        response = await service.synthesize(request)
        assert response.audio_url.startswith("/api/speech/audio/")
        assert response.mime_type == "audio/mpeg"
        assert response.timestamps == "none"
        token = response.audio_url.rsplit("/", 1)[-1]
        content, mime_type = service.take_audio(token)
        assert content.startswith(b"ID3") and mime_type == "audio/mpeg"
        with pytest.raises(DomainError) as expired:
            service.take_audio(token)
        assert expired.value.status == 404

    asyncio.run(run())


def test_audio_registry_recovers_completed_files_and_drops_partial_files(tmp_path: Path):
    token = "a" * 32
    completed = tmp_path / f"{token}.mp3"
    partial = tmp_path / ".orphan.part"
    completed.write_bytes(b"ID3recovered")
    partial.write_bytes(b"unfinished")
    service = CampusSpeechService(settings(), tmp_path)
    assert not partial.exists()
    assert service.take_audio(token) == (b"ID3recovered", "audio/mpeg")
    assert not completed.exists()


def test_stop_cancels_running_tts_and_preserves_session(monkeypatch, tmp_path: Path):
    started = asyncio.Event()

    class WaitingCommunicate:
        async def save(self, target: str):
            started.set()
            await asyncio.sleep(20)

    monkeypatch.setattr("backend.speech.service.prepare_edge_tts", lambda text, voice: WaitingCommunicate())

    async def run():
        service = CampusSpeechService(settings(), tmp_path)
        request = TtsRequest(
            request_id=uuid4(),
            session_id=uuid4(),
            utterance_id=uuid4(),
            text="这段语音会被打断。",
            voice_id="zh-CN-XiaoxiaoNeural",
        )
        task = asyncio.create_task(service.synthesize(request))
        await asyncio.wait_for(started.wait(), timeout=1)
        stopped = await service.stop(SpeechContext(request_id=request.request_id, session_id=request.session_id))
        assert stopped.local_stopped is True
        assert stopped.upstream_stop == "unconfirmed"
        with pytest.raises(DomainError) as cancelled:
            await task
        assert cancelled.value.code == "stopped"
        mismatch = SpeechContext(request_id=request.request_id, session_id=uuid4())
        with pytest.raises(DomainError) as conflict:
            await service.stop(mismatch)
        assert conflict.value.status == 409

    asyncio.run(run())
