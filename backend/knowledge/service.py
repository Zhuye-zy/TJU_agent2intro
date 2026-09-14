"""D owns implementation after M0. Empty means unavailable, never fabricated knowledge."""
from typing import Protocol
from backend.contracts import Building, CampusId, KnowledgeStatus, Source
class KnowledgeAdapter(Protocol):
    def search(self, query: str, campus_id: CampusId, limit: int) -> list[Source]: ...
    def get_status(self) -> KnowledgeStatus: ...
    def list_buildings(self, campus_id: CampusId) -> list[Building]: ...
    def get_building(self, id: str) -> Building | None: ...
class UnavailableKnowledge:
    def search(self, query: str, campus_id: CampusId, limit: int) -> list[Source]:
        return []
    def get_status(self) -> KnowledgeStatus:
        return KnowledgeStatus(status="unavailable", version=None, document_count=0, building_count=0, updated_at=None)
    def list_buildings(self, campus_id: CampusId) -> list[Building]:
        return []
    def get_building(self, id: str) -> Building | None:
        return None
knowledge: KnowledgeAdapter = UnavailableKnowledge()
