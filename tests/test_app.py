"""Offline tests: the FortyGuard API is replaced with httpx.MockTransport (no key, no credits)."""
import json

import httpx
import pytest
from fastapi.testclient import TestClient

from app import main

AID = "5ca4bab3-7ae2-463f-b7a9-8ab77bc5e6c0"
calls = {"post": 0, "get": 0}


def tile(i, v):
    x = -118.25 + i * 0.001
    ring = [[x, 34.05], [x + 0.001, 34.05], [x + 0.001, 34.051], [x, 34.051], [x, 34.05]]
    return {"id": str(i), "type": "Feature", "properties": {"tile_id": i, "value": v},
            "geometry": {"type": "Polygon", "coordinates": [ring]}}


def handler(request: httpx.Request) -> httpx.Response:
    assert request.headers["api-key"] == "test-key"
    if request.method == "POST" and request.url.path == "/v1/heatmap":
        calls["post"] += 1
        body = json.loads(request.content)
        assert body["polygon_aoi"]["features"][0]["geometry"]["coordinates"][0][0] == \
            body["polygon_aoi"]["features"][0]["geometry"]["coordinates"][0][-1]
        aid = AID if calls["post"] == 1 else AID[:-1] + "1"
        return httpx.Response(200, json={"error": False, "status_code": 200, "data": {"activity_id": aid}})
    if request.method == "GET" and request.url.path.startswith("/v1/status/"):
        calls["get"] += 1
        aid = request.url.path.rsplit("/", 1)[1]
        base = 20 if aid == AID else 25
        tiles = [tile(i, base + i) for i in range(5)]
        return httpx.Response(200, json={"error": False, "data": {"activity_id": aid, "status": "Completed", "result": {
            "map_data": {"type": "FeatureCollection", "features": tiles},
            "stats_data": {"n_cells": 5}}}})
    return httpx.Response(404)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("FORTYGUARD_API_KEY", "test-key")
    monkeypatch.setattr(main, "RUNS_DIR", tmp_path / "runs")
    monkeypatch.setattr(main, "INDEX_DIR", tmp_path / "index")
    monkeypatch.setattr(main, "get_client", lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)))
    calls.update(post=0, get=0)
    return TestClient(main.app)


REQ = {"bbox": [-118.275, 34.035, -118.225, 34.065], "start_date": "2026-11-01"}


def test_validation_rejects_bad_input(client):
    assert client.post("/api/preview", json={**REQ, "bbox": [34.0, -118.2, 34.1, -118.1]}).status_code == 422  # lat/lon swapped
    assert client.post("/api/preview", json={**REQ, "granularity": 50}).status_code == 422
    assert client.post("/api/preview", json={**REQ, "start_time": "18:00", "end_time": "06:00"}).status_code == 422


def test_preview_is_free_and_warns_outside_us(client):
    ok = client.post("/api/preview", json=REQ).json()
    assert ok["warnings"] == [] and calls["post"] == 0
    cairo = client.post("/api/preview", json={**REQ, "bbox": [31.2, 30.0, 31.3, 30.1]}).json()
    assert any("outside the contiguous US" in w for w in cairo["warnings"])


def test_submit_poll_and_cache(client):
    a = client.post("/api/heatmap", json=REQ).json()
    assert a == {"activity_id": AID, "cached": False}
    r = client.get(f"/api/status/{AID}").json()
    assert r["n_tiles"] == 5 and r["summary"]["min"] == 20
    again = client.post("/api/heatmap", json=REQ).json()  # identical request: no second paid call
    assert again["cached"] is True and calls["post"] == 1
    client.get(f"/api/status/{AID}")  # archived: no second poll
    assert calls["get"] == 1


def test_compare_and_isolation(client, monkeypatch):
    client.post("/api/heatmap", json=REQ); client.get(f"/api/status/{AID}")
    other = {**REQ, "start_date": "2026-11-02"}
    b = client.post("/api/heatmap", json=other).json()["activity_id"]; client.get(f"/api/status/{b}")
    cmp = client.get(f"/api/compare?a={AID}&b={b}").json()
    assert cmp["matched_tiles"] == 5 and cmp["delta_summary"]["mean"] == 5
    assert len(client.get("/api/runs").json()) == 2
    monkeypatch.setenv("FORTYGUARD_API_KEY", "someone-else")  # another key must not read these runs
    assert client.get(f"/api/status/{AID}").status_code == 404
    assert client.get("/api/runs").json() == []


def test_bad_activity_id_rejected(client):
    assert client.get("/api/status/..%2F..%2Fetc").status_code in (400, 404)
