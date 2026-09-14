from pathlib import Path

from backend.knowledge.service import LocalKnowledge


def test_status_counts_are_backed_by_checked_in_data():
    adapter = LocalKnowledge()
    status = adapter.get_status()
    assert status.status == "ready"
    assert status.document_count == 7
    assert status.building_count == 2
    assert status.version and status.version.startswith("sha256:")
    assert status.updated_at == "2026-09-14"


def test_alias_and_building_association_are_searchable():
    adapter = LocalKnowledge()
    hits = adapter.search("郑东馆", "beiyangyuan", 5)
    assert [hit.id for hit in hits] == ["beiyangyuan-zhengdong-library"]
    building = adapter.get_building("beiyangyuan-zhengdong-library")
    assert building and building.coordinates is None
    assert building.campus_id == "beiyangyuan"
    assert "图书馆" in building.title


def test_campus_filter_and_unknown_question_do_not_invent_answer():
    adapter = LocalKnowledge()
    assert adapter.search("七里台", "beiyangyuan", 5) == []
    assert adapter.search("食堂几点开门", "weijinlu", 5) == []
    assert adapter.list_buildings("weijinlu") == []


def test_source_fields_and_historical_map_marker_are_complete():
    adapter = LocalKnowledge()
    hit = adapter.search("地图", "weijinlu", 5)[0]
    assert hit.id == "campus-maps-2017"
    assert hit.url == "https://zs.tju.edu.cn/info/1091/1227.htm"
    assert hit.published_at == "2017-06-01"
    assert hit.retrieved_at == "2026-09-14"


def test_empty_portable_data_directory_is_unavailable(tmp_path: Path):
    adapter = LocalKnowledge(tmp_path)
    assert adapter.get_status().status == "unavailable"
    assert adapter.search("图书馆", "beiyangyuan", 5) == []
