"""Isolated contract/stub checks; no production model state mutation."""
from uuid import uuid4
import pytest
from pydantic import ValidationError, TypeAdapter
from fastapi.testclient import TestClient
from backend.app import app
from backend.r2_contracts import R2ChatRequest, SchematicPosition, StreamEvent
def body():
    return dict(request_id=str(uuid4()),session_id=str(uuid4()),message_id=str(uuid4()),message="你好",mode="general_chat",campus_id="weijinlu",selected_poi_id=None)
def test_entity_alias_and_generation_mode():
    data=body();data["selected_poi_id"]="test"
    assert R2ChatRequest(**data).selected_building_id=="test"
    with pytest.raises(ValidationError):R2ChatRequest(**dict(data,selected_building_id="different"))
    with pytest.raises(ValidationError):R2ChatRequest(**dict(data,mode="unknown"))
    with pytest.raises(ValidationError):R2ChatRequest(**dict(data,mode="content_generation"))
def test_schematic_is_not_geography():
    with pytest.raises(ValidationError):SchematicPosition(map_id="map",x=117.3,y=39.1,source_ref="s",quality="schematic")
def test_event_payload_discriminator():
    with pytest.raises(ValidationError):TypeAdapter(StreamEvent).validate_python(dict(event_id=uuid4(),request_id=uuid4(),seq=1,timestamp="now",type="answer_delta",payload={"reasoning":"hidden"}))
def test_real_endpoints_and_config_do_not_claim_missing_capabilities():
    with TestClient(app) as c:
        invalid=body();invalid["mode"]="content_generation"
        assert c.post("/api/chat/stream",json=invalid).status_code==422
        page=c.get("/api/knowledge/pois?campus_id=weijinlu").json()
        assert page["total"]>=30 and page["version"]
        config=c.get("/api/maps/config").json()
        assert "security_key" not in config and "securityJsCode" not in config
        assert config["route_backend"]=="js_api"
        if not config["status"]["js_key_configured"]:
            assert config["status"]["online_map"]=="NOT_CONFIGURED"
def test_manual_origin_stays_distinct_from_authorized_location():
    from backend.r2_contracts import UserPosition
    p=UserPosition(lng=117,lat=39,crs="GCJ02",source="manual",accuracy_m=None,timestamp="2026-09-14T00:00:00Z")
    assert p.source=="manual" and p.accuracy_m is None
