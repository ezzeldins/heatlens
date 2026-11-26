"""HeatLens: a small local web app on top of the FortyGuard Temperature API.

Only the heatmap endpoint is wired up (its request/response shape is known from a
recorded example). Other endpoints (satellite, street view, environmental params,
heat intelligence) are intentionally left for when their docs are available.

Design notes
- The API key never leaves the server and is never logged or stored.
- Calls cost credits, so every request is hashed; an identical request is served
  from disk (or re-attached to the in-flight job) instead of being paid for twice.
- Results are keyed by a digest of the key + base URL, so a key only reads its own runs.
"""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import time
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator, model_validator

load_dotenv()

BASE_URL = os.environ.get("FORTYGUARD_BASE_URL", "https://api.fortyguard.com").rstrip("/")
DATA_DIR = Path(os.environ.get("HEATLENS_DATA_DIR", "data")).resolve()
RUNS_DIR = DATA_DIR / "runs"
INDEX_DIR = DATA_DIR / "index"
EARTH_RADIUS_M = 6_371_008.8
SQ_M_PER_SQ_MI = 2_589_988.11
ID_RE = re.compile(r"^[A-Za-z0-9-]{8,64}$")
AREA_WARN_SQ_MI = 10.0

app = FastAPI(title="HeatLens")


def api_key() -> str:
    key = os.environ.get("FORTYGUARD_API_KEY", "").strip()
    if not key:
        raise HTTPException(500, "FORTYGUARD_API_KEY is not set on the server (see .env.example).")
    return key


def key_digest() -> str:
    raw = f"{os.environ.get('FORTYGUARD_API_KEY', '')}|{BASE_URL}".encode()
    return hashlib.sha256(raw).hexdigest()[:16]


def get_client() -> httpx.AsyncClient:  # overridable in tests
    return httpx.AsyncClient(timeout=httpx.Timeout(60.0))


def bbox_area_sq_mi(w: float, s: float, e: float, n: float) -> float:
    lam = math.radians(abs(e - w))
    area_m2 = EARTH_RADIUS_M**2 * lam * abs(math.sin(math.radians(n)) - math.sin(math.radians(s)))
    return area_m2 / SQ_M_PER_SQ_MI


class HeatmapReq(BaseModel):
    bbox: list[float]
    granularity: int = 100
    start_date: str
    start_time: str = "06:00"
    end_time: str = "18:00"
    filter_type: int = 2
    analytic_type: str = "exceedance"
    threshold: Optional[float] = 30
    direction: Optional[str] = "above"

    @field_validator("bbox")
    @classmethod
    def _bbox(cls, v: list[float]) -> list[float]:
        if len(v) != 4:
            raise ValueError("bbox must be [west, south, east, north]")
        w, s, e, n = v
        if not (-90 <= s <= 90 and -90 <= n <= 90):
            raise ValueError("Latitude must be between -90 and 90 (is the order [west, south, east, north]?)")
        if not (-180 <= w <= 180 and -180 <= e <= 180):
            raise ValueError("Longitude must be between -180 and 180")
        if not (w < e and s < n):
            raise ValueError("bbox must have west < east and south < north")
        return v

    @field_validator("granularity")
    @classmethod
    def _gran(cls, v: int) -> int:
        if v not in (60, 80, 100):
            raise ValueError("granularity must be 60, 80 or 100")
        return v

    @field_validator("start_date")
    @classmethod
    def _date(cls, v: str) -> str:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
            raise ValueError("start_date must be YYYY-MM-DD")
        return v

    @field_validator("start_time", "end_time")
    @classmethod
    def _time(cls, v: str) -> str:
        if not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", v):
            raise ValueError("times must be HH:MM (local to the area of interest, not UTC)")
        return v

    @model_validator(mode="after")
    def _order(self) -> "HeatmapReq":
        if self.start_time >= self.end_time:
            raise ValueError("start_time must be before end_time")
        return self

    def payload(self) -> dict[str, Any]:
        w, s, e, n = self.bbox
        ring = [[w, s], [e, s], [e, n], [w, n], [w, s]]
        body: dict[str, Any] = {
            "polygon_aoi": {
                "type": "FeatureCollection",
                "features": [
                    {"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [ring]}}
                ],
            },
            "granularity": self.granularity,
            "date_time": {
                "start_date": self.start_date,
                "start_time": self.start_time,
                "end_time": self.end_time,
                "filter_type": self.filter_type,
            },
            "analytic_type": self.analytic_type,
        }
        if self.threshold is not None:
            body["threshold"] = self.threshold
        if self.direction:
            body["direction"] = self.direction
        return body


def payload_hash(payload: dict[str, Any]) -> str:
    canon = json.dumps({"k": key_digest(), "p": payload}, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canon.encode()).hexdigest()


def run_path(activity_id: str) -> Path:
    if not ID_RE.fullmatch(activity_id):
        raise HTTPException(400, "Invalid activity id")
    return RUNS_DIR / f"{activity_id}.json"


def save_run(run: dict[str, Any]) -> None:
    RUNS_DIR.mkdir(parents=True, exist_ok=True)
    run["key_digest"] = key_digest()
    tmp = run_path(run["activity_id"]).with_suffix(".tmp")
    tmp.write_text(json.dumps(run))
    tmp.replace(run_path(run["activity_id"]))


def load_run(activity_id: str) -> Optional[dict[str, Any]]:
    p = run_path(activity_id)
    if not p.exists():
        return None
    run = json.loads(p.read_text())
    return run if run.get("key_digest") == key_digest() else None


def tiles_of(run: dict[str, Any]) -> list[dict[str, Any]]:
    try:
        return run["result"]["map_data"]["features"]
    except (KeyError, TypeError):
        return []


def summarize(values: list[float]) -> dict[str, Any]:
    if not values:
        return {"n": 0}
    vs = sorted(values)

    def q(p: float) -> float:
        i = (len(vs) - 1) * p
        lo, hi = math.floor(i), math.ceil(i)
        return vs[lo] + (vs[hi] - vs[lo]) * (i - lo)

    return {
        "n": len(vs),
        "min": vs[0],
        "max": vs[-1],
        "mean": sum(vs) / len(vs),
        "quantile_breaks": [q(p) for p in (0.2, 0.4, 0.6, 0.8)],
    }


def public_run(run: dict[str, Any], include_result: bool = True) -> dict[str, Any]:
    out = {k: run[k] for k in ("activity_id", "request", "submitted_at", "status") if k in run}
    feats = tiles_of(run)
    out["n_tiles"] = len(feats)
    out["summary"] = summarize([f["properties"]["value"] for f in feats if "value" in f.get("properties", {})])
    if include_result and run.get("result"):
        out["result"] = run["result"]
    return out


def upstream_error(r: httpx.Response) -> HTTPException:
    try:
        msg = r.json()
    except ValueError:
        msg = r.text[:500]
    return HTTPException(502 if r.status_code >= 500 else r.status_code, {"upstream_status": r.status_code, "upstream": msg})


@app.get("/api/config")
def config() -> dict[str, Any]:
    return {"base_url": BASE_URL, "key_configured": bool(os.environ.get("FORTYGUARD_API_KEY", "").strip())}


@app.post("/api/preview")
def preview(req: HeatmapReq) -> dict[str, Any]:
    w, s, e, n = req.bbox
    area = bbox_area_sq_mi(w, s, e, n)
    warnings = []
    if area > AREA_WARN_SQ_MI:
        warnings.append(f"Area is {area:.1f} sq mi; Basic plans reportedly cap at {AREA_WARN_SQ_MI:g} sq mi.")
    if not (24 <= s and n <= 50 and -125 <= w and e <= -66):
        warnings.append("Area is outside the contiguous US. Out-of-coverage requests can return zero tiles and may still be billed.")
    payload = req.payload()
    h = payload_hash(payload)
    cached = (INDEX_DIR / h).exists()
    return {"area_sq_mi": area, "warnings": warnings, "payload": payload, "already_run": cached}


@app.post("/api/heatmap")
async def submit_heatmap(req: HeatmapReq) -> dict[str, Any]:
    payload = req.payload()
    h = payload_hash(payload)
    idx = INDEX_DIR / h
    if idx.exists():
        aid = idx.read_text().strip()
        if load_run(aid):
            return {"activity_id": aid, "cached": True}

    async with get_client() as c:
        r = await c.post(f"{BASE_URL}/v1/heatmap", json=payload, headers={"api-key": api_key()})
    if r.status_code != 200:
        raise upstream_error(r)
    body = r.json()
    aid = (body.get("data") or {}).get("activity_id")
    if body.get("error") or not aid:
        raise HTTPException(502, {"upstream": body})
    save_run(
        {
            "activity_id": aid,
            "request": req.model_dump(),
            "payload": payload,
            "submitted_at": time.time(),
            "status": "Submitted",
            "result": None,
        }
    )
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    idx.write_text(aid)
    return {"activity_id": aid, "cached": False}


@app.get("/api/status/{activity_id}")
async def status(activity_id: str) -> dict[str, Any]:
    run = load_run(activity_id)
    if run is None:
        raise HTTPException(404, "Unknown activity id (not submitted from this app with this key)")
    if run.get("result"):  # already archived: free
        return public_run(run)
    async with get_client() as c:
        r = await c.get(f"{BASE_URL}/v1/status/{quote(activity_id, safe='')}", headers={"api-key": api_key()})
    if r.status_code != 200:
        raise upstream_error(r)
    data = (r.json().get("data") or {})
    st = str(data.get("status", "Unknown"))
    run["status"] = st
    if st.lower() == "completed" and data.get("result"):
        run["result"] = data["result"]
    save_run(run)
    out = public_run(run)
    if st.lower() == "completed" and out["n_tiles"] == 0:
        out["warning"] = "Completed with 0 tiles: outside coverage, below minimum area, or no data for that date. This is typically still billed."
    return out


@app.get("/api/runs")
def runs() -> list[dict[str, Any]]:
    items = []
    if RUNS_DIR.exists():
        for p in RUNS_DIR.glob("*.json"):
            try:
                run = json.loads(p.read_text())
            except ValueError:
                continue
            if run.get("key_digest") == key_digest():
                items.append(public_run(run, include_result=False))
    return sorted(items, key=lambda x: x.get("submitted_at", 0), reverse=True)


@app.get("/api/compare")
def compare(a: str, b: str) -> dict[str, Any]:
    ra, rb = load_run(a), load_run(b)
    if not ra or not rb or not ra.get("result") or not rb.get("result"):
        raise HTTPException(400, "Both runs must exist and be completed")
    same_area = ra["payload"]["polygon_aoi"] == rb["payload"]["polygon_aoi"]
    if not same_area or ra["payload"]["granularity"] != rb["payload"]["granularity"]:
        raise HTTPException(400, "Runs must use the same area and granularity to compare tile by tile")
    vb = {f["properties"]["tile_id"]: f["properties"].get("value") for f in tiles_of(rb)}
    feats, deltas = [], []
    for f in tiles_of(ra):
        tid = f["properties"]["tile_id"]
        va, vbv = f["properties"].get("value"), vb.get(tid)
        if va is None or vbv is None:
            continue
        d = vbv - va
        deltas.append(d)
        feats.append(
            {
                "type": "Feature",
                "geometry": f["geometry"],
                "properties": {"tile_id": tid, "a": va, "b": vbv, "delta": d},
            }
        )
    return {
        "matched_tiles": len(feats),
        "a_request": ra["request"], "b_request": rb["request"],
        "delta_summary": summarize(deltas),
        "map_data": {"type": "FeatureCollection", "features": feats},
    }


@app.get("/")
def index() -> FileResponse:
    return FileResponse(Path(__file__).parent / "static" / "index.html")


app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")
