"""Photo scene identification: on-device OCR text + optional location -> POI match -> glm-5.1 narration."""
from __future__ import annotations
import difflib, math, re, time
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field
from backend.common.errors import DomainError
from backend.contracts import CampusId, Usage
from backend.knowledge.service import knowledge
from .privacy import redact_coordinates
from .runtime import runtime
from .service import SYSTEM_PROMPT, model as campus_model

_PUNCT = re.compile(r"[\s\u3000,，。.、:：;；!！?？·•\-—_/\\|()（）\[\]【】\"'“”‘’<>《》]+")
_SPACE = re.compile(r"\s+")
_MATCH_THRESHOLD = 0.9
_CANDIDATE_THRESHOLD = 0.45
_NEAR_METERS = 150.0
_MAX_POI_PAGE = 500


class SceneIdentifyRequest(BaseModel):
    request_id: UUID
    session_id: UUID
    campus_id: CampusId
    ocr_text: str = Field(default="", max_length=2000)
    lng: float | None = Field(default=None, ge=-180, le=180)
    lat: float | None = Field(default=None, ge=-90, le=90)
    poi_id: str | None = Field(default=None, max_length=120)


class SceneCandidate(BaseModel):
    id: str
    name: str
    category: str
    score: float
    reason: str
    description: str


class SceneIdentifyResponse(BaseModel):
    request_id: UUID
    status: Literal["matched", "candidates", "not_found"]
    poi: SceneCandidate | None
    candidates: list[SceneCandidate]
    ocr_text: str
    narration: str
    model: str | None
    usage: Usage | None


def _normalize(text: str) -> str:
    return _PUNCT.sub("", text or "").lower()


def _distance_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    rad = math.pi / 180
    dlat, dlng = (lat2 - lat1) * rad, (lng2 - lng1) * rad
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1 * rad) * math.cos(lat2 * rad) * math.sin(dlng / 2) ** 2
    return 6371000 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _text_score(text: str, poi) -> tuple[float, str]:
    best, reason = 0.0, ""
    for alias in (poi.name, *poi.aliases):
        name = _normalize(alias)
        if not name:
            continue
        if name == text:
            return 2.0, "名称完全一致"
        if name in text:
            score = 1.0 + min(0.5, len(name) / 20)
            if score > best:
                best, reason = score, f"照片文字包含“{alias}”"
        elif len(name) >= 3:
            ratio = difflib.SequenceMatcher(None, name, text).ratio()
            if ratio >= 0.55 and ratio * 0.9 > best:
                best, reason = ratio * 0.9, f"照片文字接近“{alias}”"
    return best, reason


def match_pois(campus_id: CampusId, ocr_text: str, lng: float | None = None, lat: float | None = None,
               poi_id: str | None = None, limit: int = 4) -> tuple[list[SceneCandidate], bool]:
    """Return (ranked candidates, matched flag). Deterministic; no model call here."""
    text = _normalize(ocr_text)
    if poi_id:
        poi = knowledge.get_poi(poi_id)
        if poi is None or poi.campus_id != campus_id:
            raise DomainError("poi_not_found", "所选点位不存在或不属于当前校区", 422)
        return [SceneCandidate(id=poi.id, name=poi.name, category=poi.category, score=2.0,
                               reason="用户已确认地点", description=poi.description)], True
    ranked: list[SceneCandidate] = []
    for poi in knowledge.list_pois(campus_id, None, "", _MAX_POI_PAGE, None).items:
        score, reason = _text_score(text, poi) if text else (0.0, "")
        if lng is not None and lat is not None and poi.location is not None:
            distance = _distance_meters(lat, lng, poi.location.lat, poi.location.lng)
            if distance <= _NEAR_METERS:
                score += 0.9
                reason = (reason + "；" if reason else "") + f"距定位约 {round(distance)} 米"
            elif distance <= 400:
                score += 0.35
                reason = (reason + "；" if reason else "") + f"距定位约 {round(distance)} 米"
        if score <= 0:
            continue
        ranked.append(SceneCandidate(id=poi.id, name=poi.name, category=poi.category,
                                     score=round(min(score, 2.5), 3), reason=reason, description=poi.description))
    ranked.sort(key=lambda item: (-item.score, item.id))
    if not ranked:
        return [], False
    return ranked[:limit], ranked[0].score >= _MATCH_THRESHOLD


def _narration_messages(poi: SceneCandidate, hits: list, ocr_text: str) -> list[dict]:
    facts = "\n".join(f"- {item.snippet[:400]}" for item in hits[:5]) or "（本地资料未检索到该地点的直接条目；只做通用介绍，并说明未核验。）"
    source = redact_coordinates(ocr_text)[:400] or "（未识别到可用文字）"
    user = (
        "用户拍下了一张校园实景照片。设备端离线 OCR 识别到的文字如下，可能有噪声：\n"
        f"{source}\n"
        f"识别命中的地点：{poi.name}（类别 {poi.category}）。\n"
        f"地点简介：{poi.description}\n"
        f"本地资料摘录：\n{facts}\n\n"
        "请写一段 140~220 字的实景讲解，要求：\n"
        "1. 先用一句话把照片线索与眼前景物对应起来；\n"
        "2. 讲 2~3 个有资料依据的亮点，不要罗列资料原文；\n"
        "3. 结尾给一个现场可验证的观察点或拍照建议；\n"
        "4. 不得编造资料未载明的年份、数字、开放时间与准入条件；不要输出来源编号。"
    )
    return [{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": user}]


async def identify_scene(request: SceneIdentifyRequest) -> SceneIdentifyResponse:
    runtime.begin(request.request_id, request.session_id)
    started = time.monotonic()
    runtime.emit(request.request_id, "request", "started")
    try:
        if not request.ocr_text.strip() and request.poi_id is None and (request.lng is None or request.lat is None):
            raise DomainError("VALIDATION_ERROR", "请提供照片识别文字、定位或直接选择地点", 422, request.request_id)
        match_started = time.monotonic()
        runtime.emit(request.request_id, "scene", "started", {"count": len(request.ocr_text)})
        ranked, matched = match_pois(request.campus_id, request.ocr_text, request.lng, request.lat, request.poi_id)
        runtime.trace(request.request_id, action="scene.match", stage="scene",
                      status="completed" if matched else "candidates", elapsed_ms=(time.monotonic() - match_started) * 1000,
                      body_chars=len(ranked))
        runtime.emit(request.request_id, "scene", "completed",
                     {"count": len(ranked), "code": "MATCHED" if matched else ("CANDIDATES" if ranked else "NOT_FOUND")},
                     (time.monotonic() - match_started) * 1000)
        if not matched:
            status: Literal["matched", "candidates", "not_found"] = "candidates" if ranked else "not_found"
            response = SceneIdentifyResponse(request_id=request.request_id, status=status, poi=None,
                                             candidates=ranked, ocr_text=request.ocr_text, narration="",
                                             model=None, usage=None)
            runtime.finish(request.request_id, "completed", 0)
            runtime.emit(request.request_id, "request", "completed", duration_ms=(time.monotonic() - started) * 1000)
            return response
        poi = ranked[0]
        status = "matched"
        hits = [hit for hit in knowledge.search(f"{poi.name} {request.campus_id}", request.campus_id, 5)
                if hit.campus_id == request.campus_id]
        narration, usage, model_name = await campus_model.provider.complete(
            request.request_id, _narration_messages(poi, hits, request.ocr_text))
        response = SceneIdentifyResponse(request_id=request.request_id, status=status, poi=poi, candidates=ranked[1:],
                                         ocr_text=request.ocr_text, narration=narration, model=model_name, usage=usage)
        runtime.finish(request.request_id, "completed", len(narration))
        runtime.emit(request.request_id, "request", "completed", duration_ms=(time.monotonic() - started) * 1000)
        return response
    except Exception as error:
        runtime.finish(request.request_id, "failed")
        code = error.code if isinstance(error, DomainError) else "internal_error"
        runtime.emit(request.request_id, "request", "failed", {"code": code}, (time.monotonic() - started) * 1000)
        if isinstance(error, DomainError):
            raise
        raise DomainError("internal_error", "拍照识景处理失败", 500, request.request_id) from None
