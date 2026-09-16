from types import SimpleNamespace
from uuid import uuid4

import pytest

from backend.common.errors import DomainError
from backend.contracts import Usage
from backend.knowledge.service import knowledge
from backend.model import scene as scene_module
from backend.model.runtime import RuntimeStore
from backend.model.scene import SceneIdentifyRequest, identify_scene, match_pois


class StubProvider:
    def __init__(self):
        self.calls = []

    async def complete(self, rid, messages):
        self.calls.append(messages)
        return "这是实景讲解正文。", Usage(prompt_tokens=10, completion_tokens=20, total_tokens=30), "glm-5.1"


def _pois(campus="weijinlu"):
    return knowledge.list_pois(campus, None, "", 500, None).items


def _request(**overrides):
    payload = {"request_id": uuid4(), "session_id": uuid4(), "campus_id": "weijinlu", "ocr_text": ""}
    payload.update(overrides)
    return SceneIdentifyRequest(**payload)


@pytest.fixture(autouse=True)
def isolated_runtime(monkeypatch):
    store = RuntimeStore()
    provider = StubProvider()
    monkeypatch.setattr(scene_module, "runtime", store)
    monkeypatch.setattr(scene_module, "campus_model", SimpleNamespace(provider=provider))
    return provider


def test_match_by_exact_name_and_narrate():
    poi = next(item for item in _pois() if len(item.name) >= 3)
    request = _request(ocr_text=f"天津大学 {poi.name} 参观入口")
    response = asyncio_run(identify_scene(request))
    assert response.status == "matched"
    assert response.poi is not None and response.poi.id == poi.id
    assert response.narration == "这是实景讲解正文。"
    assert response.model == "glm-5.1" and response.usage is not None
    assert response.ocr_text == request.ocr_text


def test_match_by_alias_with_ocr_noise(isolated_runtime):
    poi = next(item for item in _pois() if item.aliases and len(max(item.aliases, key=len)) >= 3)
    alias = max(poi.aliases, key=len)
    response = asyncio_run(identify_scene(_request(ocr_text=f"随手拍 1 张·{alias}·到此一游")))
    assert response.status == "matched" and response.poi is not None
    assert response.poi.id == poi.id
    assert isolated_runtime.calls


def _geo_poi():
    from backend.r2_contracts import GeoLocation
    base = _pois()[0]
    location = GeoLocation(lng=117.172, lat=39.108, crs="GCJ02", coordinate_source="test-fixture",
                           verified_at="2026-09-01", quality="entrance")
    return base.model_copy(update={"location": location})


def test_location_only_match_without_ocr(monkeypatch):
    poi = _geo_poi()
    monkeypatch.setattr(scene_module, "knowledge", SimpleNamespace(
        list_pois=lambda *args, **kwargs: SimpleNamespace(items=[poi]), get_poi=lambda *args: None,
        search=lambda *args, **kwargs: []))
    response = asyncio_run(identify_scene(_request(ocr_text="", lng=poi.location.lng, lat=poi.location.lat)))
    assert response.status == "matched" and response.poi is not None and response.poi.id == poi.id
    assert "定位" in response.poi.reason


def test_unmatched_returns_candidates_without_model_call(isolated_runtime):
    response = asyncio_run(identify_scene(_request(ocr_text="今天天气不错，随便看看")))
    assert response.status in {"candidates", "not_found"}
    assert response.narration == "" and response.model is None
    assert not isolated_runtime.calls


def test_confirmed_poi_id_bypasses_matching(isolated_runtime):
    poi = _pois()[0]
    response = asyncio_run(identify_scene(_request(ocr_text="", poi_id=poi.id)))
    assert response.status == "matched" and response.poi is not None and response.poi.id == poi.id
    assert isolated_runtime.calls


def test_requires_any_signal():
    with pytest.raises(DomainError) as error:
        asyncio_run(identify_scene(_request(ocr_text="   ")))
    assert error.value.code == "VALIDATION_ERROR"


def test_match_pois_location_bonus_and_far_negative(monkeypatch):
    poi = _geo_poi()
    monkeypatch.setattr(scene_module, "knowledge", SimpleNamespace(
        list_pois=lambda *args, **kwargs: SimpleNamespace(items=[poi]), get_poi=lambda *args: None))
    ranked, matched = match_pois("weijinlu", "", poi.location.lng, poi.location.lat)
    assert matched and ranked[0].id == poi.id and "定位" in ranked[0].reason
    far, far_matched = match_pois("weijinlu", "", poi.location.lng + 0.2, poi.location.lat + 0.2)
    assert not far and not far_matched


def asyncio_run(coroutine):
    import asyncio
    return asyncio.run(coroutine)
