from fastapi.testclient import TestClient

from backend.app import app
from backend.knowledge.service import LocalKnowledge


def test_catalog_paginates_without_repeating_entities():
    knowledge = LocalKnowledge()
    first = knowledge.list_pois("weijinlu", None, "", 10, None)
    assert first.total == 50
    assert len(first.items) == 10 and first.next_cursor
    second = knowledge.list_pois("weijinlu", None, "", 10, first.next_cursor)
    assert not {poi.id for poi in first.items} & {poi.id for poi in second.items}
    assert second.total == first.total


def test_alias_campus_filter_and_unknown_question():
    knowledge = LocalKnowledge()
    result = knowledge.list_pois("weijinlu", "library", "北馆", 20, None)
    assert [poi.id for poi in result.items] == ["weijinlu-chunshui-library"]
    assert knowledge.list_pois("beiyangyuan", None, "春水", 20, None).items == []
    assert knowledge.search("今天食堂几点开门", "beiyangyuan", 5) == []


def test_cursor_is_bound_to_filter_and_version():
    knowledge = LocalKnowledge()
    cursor = knowledge.list_pois("weijinlu", None, "", 1, None).next_cursor
    assert cursor
    try:
        knowledge.list_pois("beiyangyuan", None, "", 1, cursor)
    except ValueError as error:
        assert str(error) == "invalid_cursor"
    else:
        raise AssertionError("cursor from another campus was accepted")


def test_r2_http_views_are_backed_by_same_store():
    client = TestClient(app)
    coverage = client.get("/api/knowledge/coverage")
    assert coverage.status_code == 200
    assert coverage.json()["campuses"][0]["pois"] >= 30
    page = client.get("/api/knowledge/pois", params={"campus_id": "beiyangyuan", "category": "dining", "limit": 100})
    assert page.status_code == 200 and len(page.json()["items"]) == 7
    assert client.get("/api/knowledge/pois/no-such-poi").status_code == 404
    assert client.get("/api/knowledge/campus-assets", params={"campus_id": "weijinlu"}).json()["media"] == []
