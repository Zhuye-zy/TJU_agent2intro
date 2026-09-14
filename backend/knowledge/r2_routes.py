"""D implements richer views over the existing authoritative knowledge store."""
from fastapi import APIRouter, Query
from backend.contracts import CampusId
from backend.common.errors import DomainError
from backend.r2_contracts import POI, POIPage, Coverage, CampusAssets, Category
router=APIRouter(prefix="/api/knowledge", tags=["knowledge-r2"])
def pending():
    raise DomainError("not_implemented","R2 点位/资料能力尚未实现",501)
@router.get("/pois",response_model=POIPage)
def pois(campus_id:CampusId,category:Category|None=None,query:str=Query("",max_length=100),limit:int=Query(20,ge=1,le=100),cursor:str|None=Query(None,max_length=256)):
    return pending()
@router.get("/pois/{poi_id}",response_model=POI)
def poi(poi_id:str): return pending()
@router.get("/coverage",response_model=Coverage)
def coverage(): return pending()
@router.get("/campus-assets",response_model=CampusAssets)
def assets(campus_id:CampusId): return pending()
