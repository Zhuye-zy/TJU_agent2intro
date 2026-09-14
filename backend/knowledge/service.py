"""Small, local, provenance-preserving campus knowledge adapter.

This module deliberately does not fetch the web at import or query time. The
checked-in JSON corpus contains short, manually verified summaries of official
pages, rather than copies of their text or images. There is no embedding
provider in the selected M0 stack, so retrieval is deterministic keyword,
alias, and Chinese character n-gram matching.
"""
from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
from pathlib import Path
import re
from typing import Any, Protocol

from backend.contracts import Building, CampusId, KnowledgeStatus, Source


DATA_DIRECTORY = Path(__file__).resolve().parents[2] / "data" / "knowledge"
DOCUMENTS_FILE = DATA_DIRECTORY / "documents.json"
BUILDINGS_FILE = DATA_DIRECTORY / "buildings.json"
_TOKEN = re.compile(r"[a-z0-9]+|[\u3400-\u9fff]", re.IGNORECASE)


class KnowledgeAdapter(Protocol):
    def search(self, query: str, campus_id: CampusId, limit: int) -> list[Source]: ...
    def get_status(self) -> KnowledgeStatus: ...
    def list_buildings(self, campus_id: CampusId) -> list[Building]: ...
    def get_building(self, id: str) -> Building | None: ...


@dataclass(frozen=True)
class _Document:
    source: Source
    aliases: tuple[str, ...]
    building_id: str | None
    temporal_note: str | None


def _tokens(value: str) -> set[str]:
    """Return Latin words and individual CJK characters for transparent matching."""
    return set(_TOKEN.findall(value.lower()))


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
        self._version: str | None = None
        self._updated_at: str | None = None
        self._load()

    def _load(self) -> None:
        documents_path = self.data_directory / DOCUMENTS_FILE.name
        buildings_path = self.data_directory / BUILDINGS_FILE.name
        raw_documents = _load_array(documents_path)
        raw_buildings = _load_array(buildings_path)
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
        if not self._documents and not self._buildings:
            return
        payload = b""
        for path in (documents_path, buildings_path):
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
        # A lone CJK character is too ambiguous (for example, 东 appears in both
        # 郑东图书馆 and 东门); require two token matches unless an exact phrase
        # produced the explicit score bonus above.
        return [source for score, _, source in sorted(ranked, key=lambda row: (-row[0], row[1])) if score >= 2][:limit]


class UnavailableKnowledge(LocalKnowledge):
    def __init__(self):
        super().__init__(Path("__no_knowledge_data__"))


knowledge: KnowledgeAdapter = LocalKnowledge()
