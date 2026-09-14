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
def test_stubs_are_not_false_success():
    with TestClient(app) as c:
        r=c.post("/api/chat/stream",json=body());assert r.status_code==501
        assert c.get("/api/knowledge/pois?campus_id=weijinlu").status_code==501
        status=c.get("/api/maps/status").json()
        assert status["online_map"] in ("NOT_CONFIGURED","NOT_IMPLEMENTED")
        assert status["precise_location"]=="not_implemented"
        assert "security_key" not in c.get("/api/maps/config").json()
