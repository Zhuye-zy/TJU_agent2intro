from fastapi import APIRouter, Query
from backend.contracts import Building, BuildingList, CampusId, KnowledgeStatus, SearchResponse
from backend.common.errors import DomainError
from .service import knowledge
router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])
@router.get("/status", response_model=KnowledgeStatus)
def status():
    return knowledge.get_status()
@router.get("/search", response_model=SearchResponse)
def search(campus_id: CampusId, query: str = Query(min_length=1, max_length=500), limit: int = Query(5, ge=1, le=20)):
    return SearchResponse(hits=knowledge.search(query, campus_id, limit), status=knowledge.get_status())
@router.get("/buildings", response_model=BuildingList)
def buildings(campus_id: CampusId):
    return BuildingList(buildings=knowledge.list_buildings(campus_id))
@router.get("/buildings/{building_id}", response_model=Building)
def building(building_id: str):
    result = knowledge.get_building(building_id)
    if result is None:
        raise DomainError("building_not_found", "建筑 ID 不存在", 404)
    return result
