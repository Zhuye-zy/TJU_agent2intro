"""Small, local, provenance-preserving campus knowledge adapter.

This module deliberately does not fetch the web at import or query time. The
checked-in JSON corpus contains short, manually verified summaries of official
pages, rather than copies of their text or images. There is no embedding
provider in the selected M0 stack, so retrieval is deterministic keyword,
alias, and Chinese character n-gram matching.
"""
from __future__ import annotations

from dataclasses import dataclass
import base64
import binascii
from hashlib import sha256
import json
from pathlib import Path
import re
from typing import Any, Protocol

from backend.contracts import Building, CampusId, KnowledgeStatus, Source
from backend.r2_contracts import CampusAssets, CampusCounts, Coverage, POI, POIPage


DATA_DIRECTORY = Path(__file__).resolve().parents[2] / "data" / "knowledge"
DOCUMENTS_FILE = DATA_DIRECTORY / "documents.json"
BUILDINGS_FILE = DATA_DIRECTORY / "buildings.json"
POIS_FILE = DATA_DIRECTORY / "pois.json"
ASSETS_FILE = DATA_DIRECTORY / "assets.json"
_TOKEN = re.compile(r"[a-z0-9]+|[\u3400-\u9fff]+", re.IGNORECASE)


class KnowledgeAdapter(Protocol):
    def search(self, query: str, campus_id: CampusId, limit: int) -> list[Source]: ...
    def get_status(self) -> KnowledgeStatus: ...
    def list_buildings(self, campus_id: CampusId) -> list[Building]: ...
    def get_building(self, id: str) -> Building | None: ...
    def list_pois(self, campus_id: CampusId, category: str | None, query: str, limit: int, cursor: str | None) -> POIPage: ...
    def get_poi(self, id: str) -> POI | None: ...
    def get_coverage(self) -> Coverage: ...
    def get_campus_assets(self, campus_id: CampusId) -> CampusAssets: ...


@dataclass(frozen=True)
class _Document:
    source: Source
    aliases: tuple[str, ...]
    building_id: str | None
    temporal_note: str | None


def _tokens(value: str) -> set[str]:
    """Return Latin words and CJK bigrams, avoiding one-character false hits."""
    tokens: set[str] = set()
    for part in _TOKEN.findall(value.lower()):
        if part[0].isascii():
            tokens.add(part)
        else:
            tokens.update(part[index:index + 2] for index in range(len(part) - 1))
    return tokens


def _load_array(path: Path) -> list[dict[str, Any]]:
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return parsed if isinstance(parsed, list) else []


class LocalKnowledge:
    """Read a portable JSON corpus once; malformed rows are ignored safely."""

    def __init__(self, data_directory: Path = DATA_DIRECTORY):
        self.data_directory = data_directory
        self._documents: list[_Document] = []
        self._buildings: dict[str, Building] = {}
        self._building_aliases: dict[str, tuple[str, ...]] = {}
        self._pois: dict[str, POI] = {}
        self._assets: dict[str, CampusAssets] = {}
        self._version: str | None = None
        self._updated_at: str | None = None
        self._load()

    def _load(self) -> None:
        documents_path = self.data_directory / DOCUMENTS_FILE.name
        buildings_path = self.data_directory / BUILDINGS_FILE.name
        pois_path = self.data_directory / POIS_FILE.name
        assets_path = self.data_directory / ASSETS_FILE.name
        raw_documents = _load_array(documents_path)
        raw_buildings = _load_array(buildings_path)
        raw_pois = _load_array(pois_path)
        raw_assets = _load_array(assets_path)
        for row in raw_buildings:
            if not isinstance(row, dict):
                continue
            aliases = row.pop("aliases", [])
            try:
                building = Building.model_validate(row)
            except (TypeError, ValueError):
                continue
            self._buildings[building.id] = building
            self._building_aliases[building.id] = tuple(str(a) for a in aliases if isinstance(a, str))
        for row in raw_documents:
            if not isinstance(row, dict):
                continue
            aliases = row.pop("aliases", [])
            building_id = row.pop("building_id", None)
            temporal_note = row.pop("temporal_note", None)
            try:
                source = Source.model_validate(row)
            except (TypeError, ValueError):
                continue
            self._documents.append(_Document(
                source=source,
                aliases=tuple(str(a) for a in aliases if isinstance(a, str)),
                building_id=building_id if isinstance(building_id, str) else None,
                temporal_note=temporal_note if isinstance(temporal_note, str) else None,
            ))
        for row in raw_pois:
            if not isinstance(row, dict):
                continue
            try:
                poi = POI.model_validate(row)
            except (TypeError, ValueError):
                continue
            # IDs are canonical identity; retaining only one row makes repeated
            # imports idempotent and prevents alias duplicates from entering the
            # public directory.
            self._pois.setdefault(poi.id, poi)
        for row in raw_assets:
            if not isinstance(row, dict):
                continue
            campus_id = row.get("campus_id")
            if campus_id not in ("weijinlu", "beiyangyuan"):
                continue
            try:
                self._assets[campus_id] = CampusAssets.model_validate({
                    "maps": row.get("maps", []), "media": row.get("media", []), "version": None,
                })
            except (TypeError, ValueError):
                continue
        if not self._documents and not self._buildings and not self._pois:
            return
        payload = b""
        for path in (documents_path, buildings_path, pois_path, assets_path):
            try:
                payload += path.read_bytes()
            except OSError:
                pass
        self._version = f"sha256:{sha256(payload).hexdigest()[:12]}"
        dates = [document.source.retrieved_at for document in self._documents]
        dates.extend(building.retrieved_at for building in self._buildings.values())
        self._updated_at = max(dates, default=None)

    def get_status(self) -> KnowledgeStatus:
        ready = bool(self._documents or self._buildings)
        return KnowledgeStatus(
            status="ready" if ready else "unavailable",
            version=self._version if ready else None,
            document_count=len(self._documents),
            building_count=len(self._buildings),
            updated_at=self._updated_at if ready else None,
        )

    def list_buildings(self, campus_id: CampusId) -> list[Building]:
        return [building for building in self._buildings.values() if building.campus_id == campus_id]

    def get_building(self, id: str) -> Building | None:
        return self._buildings.get(id)

    def _cursor(self, campus_id: CampusId, category: str | None, query: str, offset: int) -> str:
        payload = json.dumps({"v": self._version, "c": campus_id, "g": category, "q": query, "o": offset}, separators=(",", ":"), ensure_ascii=True)
        digest = sha256(payload.encode("utf-8")).hexdigest()[:12]
        return base64.urlsafe_b64encode(f"{digest}.{payload}".encode("utf-8")).decode("ascii").rstrip("=")

    def _parse_cursor(self, cursor: str, campus_id: CampusId, category: str | None, query: str) -> int:
        try:
            decoded = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).decode("utf-8")
            digest, payload = decoded.split(".", 1)
            parsed = json.loads(payload)
            if digest != sha256(payload.encode("utf-8")).hexdigest()[:12]:
                raise ValueError
            if (parsed.get("v"), parsed.get("c"), parsed.get("g"), parsed.get("q")) != (self._version, campus_id, category, query):
                raise ValueError
            offset = parsed.get("o")
            if not isinstance(offset, int) or offset < 0:
                raise ValueError
            return offset
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError, binascii.Error):
            raise ValueError("invalid_cursor") from None

    def list_pois(self, campus_id: CampusId, category: str | None, query: str, limit: int, cursor: str | None) -> POIPage:
        normalized_query = query.strip().lower()
        offset = self._parse_cursor(cursor, campus_id, category, normalized_query) if cursor else 0
        candidates = [poi for poi in self._pois.values() if poi.campus_id == campus_id and (category is None or poi.category == category)]
        if normalized_query:
            tokens = _tokens(normalized_query)
            candidates = [poi for poi in candidates if tokens & _tokens(" ".join((poi.id, poi.name, *poi.aliases, poi.description)))]
        candidates.sort(key=lambda poi: poi.id)
        page = candidates[offset:offset + limit]
        next_offset = offset + len(page)
        return POIPage(items=page, total=len(candidates), next_cursor=(self._cursor(campus_id, category, normalized_query, next_offset) if next_offset < len(candidates) else None), version=self._version)

    def get_poi(self, id: str) -> POI | None:
        return self._pois.get(id)

    def get_coverage(self) -> Coverage:
        def campus_counts(campus_id: CampusId) -> CampusCounts:
            pois = [poi for poi in self._pois.values() if poi.campus_id == campus_id]
            facts = len([document for document in self._documents if document.source.campus_id == campus_id]) + len(pois)
            return CampusCounts(campus_id=campus_id, facts=facts, pois=len(pois), verified_coordinates=len([poi for poi in pois if poi.location and poi.location.quality != "pending"]), usable_media=len(self._assets.get(campus_id, CampusAssets(maps=[], media=[], version=None)).media))
        return Coverage(status="ready" if self._version else "not_implemented", version=self._version, source_pages=6 if self._version else 0, fact_count=sum(item.facts for item in (campus_counts("weijinlu"), campus_counts("beiyangyuan"))), chunk_count=0, campuses=[campus_counts("weijinlu"), campus_counts("beiyangyuan")])

    def get_campus_assets(self, campus_id: CampusId) -> CampusAssets:
        assets = self._assets.get(campus_id, CampusAssets(maps=[], media=[], version=None))
        return assets.model_copy(update={"version": self._version})

    def _score(self, document: _Document, query: str, query_tokens: set[str]) -> int:
        searchable = " ".join((
            document.source.title, document.source.snippet, document.source.id,
            document.building_id or "", *document.aliases,
        )).lower()
        document_tokens = _tokens(searchable)
        score = len(query_tokens & document_tokens)
        if query.lower() in searchable:
            score += 8
        if document.building_id:
            building = self._buildings.get(document.building_id)
            if building:
                fields = " ".join((building.id, building.title, *self._building_aliases.get(building.id, ()))).lower()
                building_tokens = _tokens(fields)
                # The document already carries its factual wording. Building
                # metadata adds only identifier/alias context; duplicating its
                # individual-character score would make unrelated 东 matches win.
                score += len(query_tokens & building_tokens - document_tokens)
                if query.lower() in fields:
                    score += 8
        return score

    def search(self, query: str, campus_id: CampusId, limit: int) -> list[Source]:
        query_tokens = _tokens(query)
        if not query_tokens:
            return []
        ranked = [
            (self._score(document, query, query_tokens), index, document.source)
            for index, document in enumerate(self._documents)
            if document.source.campus_id == campus_id
        ]
        return [source for score, _, source in sorted(ranked, key=lambda row: (-row[0], row[1])) if score >= 1][:limit]


class UnavailableKnowledge(LocalKnowledge):
    def __init__(self):
        super().__init__(Path("__no_knowledge_data__"))


knowledge: KnowledgeAdapter = LocalKnowledge()
