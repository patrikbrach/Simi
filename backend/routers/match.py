"""
POST /api/match/start/name    – fuzzy name match
POST /api/match/start/city    – fuzzy name + city match
POST /api/match/start/id      – exact ID match
GET  /api/match/{id}/progress – SSE stream of progress events
GET  /api/match/{id}/download – download result Excel when complete
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import SessionLocal
from routers.upload import get_dataframe, release_file
from services.excel_writer import build_result_excel, result_filename
from services.matcher import match_ids, match_names, match_names_with_city

router = APIRouter()


class JobStatus(str, Enum):
    pending = "pending"
    running = "running"
    complete = "complete"
    error = "error"


@dataclass
class Job:
    id: str
    status: JobStatus = JobStatus.pending
    events: asyncio.Queue = field(default_factory=asyncio.Queue)
    result_bytes: bytes | None = None
    result_filename: str = ""
    error: str = ""


_jobs: dict[str, Job] = {}


# ── Request schemas ───────────────────────────────────────────────────────────

class NameMatchRequest(BaseModel):
    file_a_id: str
    file_b_id: str
    column_a: str
    column_b: str
    threshold: int = 85
    file_a_name: str = ""
    file_b_name: str = ""
    extra_cols_b: list[str] = []


class NameCityMatchRequest(BaseModel):
    file_a_id: str
    file_b_id: str
    col_name_a: str
    col_name_b: str
    col_city_a: str
    col_city_b: str
    threshold: int = 85
    file_a_name: str = ""
    file_b_name: str = ""
    extra_cols_b: list[str] = []


class IdMatchRequest(BaseModel):
    file_a_id: str
    file_b_id: str
    col_id_a: str
    col_id_b: str
    col_label_b: str  # column from B to use as the matched value label
    file_a_name: str = ""
    file_b_name: str = ""
    extra_cols_b: list[str] = []


class StartResponse(BaseModel):
    job_id: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _send(job: Job, event_dict: dict) -> None:
    try:
        job.events.put_nowait(event_dict)
    except asyncio.QueueFull:
        pass


def _ip_hash(request: Request) -> str:
    ip = request.client.host if request.client else "unknown"
    return hashlib.sha256(ip.encode()).hexdigest()


def _extract_extra_cols(
    df_b, indices: list[int], cols: list[str]
) -> dict[str, list] | None:
    if not cols:
        return None
    result = {}
    for col in cols:
        if col in df_b.columns:
            result[col] = [
                str(df_b[col].iloc[idx]) if idx >= 0 else ""
                for idx in indices
            ]
    return result or None


def _log_run(use_case: str, data: dict) -> None:
    db: Session = SessionLocal()
    try:
        run = models.MatchRun(id=str(uuid.uuid4()), use_case=use_case, **data)
        db.add(run)
        db.commit()
    except Exception:
        pass
    finally:
        db.close()


def _finish(
    job: Job,
    df_a,
    match_values: list[str],
    match_scores: list[int],
    threshold: int,
    use_case: str,
    elapsed: float,
    req_meta: dict,
    label: str = "Match_Value",
    match_cities: list[str] | None = None,
    extra_b_data: dict[str, list] | None = None,
) -> None:
    above = sum(1 for s in match_scores if s >= threshold)
    avg = sum(match_scores) / len(match_scores) if match_scores else 0.0
    exact = sum(1 for s in match_scores if s == 100)

    job.result_bytes = build_result_excel(
        df_a, match_values, match_scores, threshold, label, match_cities, extra_b_data
    )
    job.result_filename = result_filename()
    job.status = JobStatus.complete

    stats = {
        "matches": above,
        "total": len(match_scores),
        "avg_score": round(avg, 1),
        "exact_matches": exact,
        "processing_time_sec": round(elapsed, 2),
    }
    _send(job, {"type": "complete", "stats": stats})

    _log_run(use_case, {
        **req_meta,
        "threshold": threshold,
        "processing_time_sec": elapsed,
        "matches_above_threshold": above,
        "avg_match_score": avg,
        "exact_matches": exact,
    })


# ── Background tasks ──────────────────────────────────────────────────────────

async def _run_name_match(job: Job, req: NameMatchRequest, ip_hash: str) -> None:
    job.status = JobStatus.running
    t0 = time.monotonic()
    try:
        _send(job, {"type": "stage", "message": "Loading files…"})
        df_a = get_dataframe(req.file_a_id)
        df_b = get_dataframe(req.file_b_id)

        if req.column_a not in df_a.columns:
            raise ValueError(f"Column '{req.column_a}' not in File A.")
        if req.column_b not in df_b.columns:
            raise ValueError(f"Column '{req.column_b}' not in File B.")

        _send(job, {"type": "stage", "message": "Building index…"})

        def cb(current: int, total: int, stage: str) -> None:
            _send(job, {"type": "progress", "current": current, "total": total, "stage": stage})

        results = await match_names(
            df_a[req.column_a].fillna("").tolist(),
            df_b[req.column_b].fillna("").tolist(),
            req.threshold, cb,
        )
        _send(job, {"type": "stage", "message": "Finalizing…"})
        _finish(
            job, df_a,
            [r[0] for r in results], [r[1] for r in results],
            req.threshold, "name_match", time.monotonic() - t0,
            {"file_a_rows": len(df_a), "file_b_rows": len(df_b),
             "file_a_name": req.file_a_name, "file_b_name": req.file_b_name,
             "client_ip_hash": ip_hash},
            extra_b_data=_extract_extra_cols(df_b, [r[2] for r in results], req.extra_cols_b),
        )
    except Exception as exc:
        job.status = JobStatus.error
        job.error = str(exc)
        _send(job, {"type": "error", "message": str(exc)})
    finally:
        release_file(req.file_a_id)
        release_file(req.file_b_id)


async def _run_name_city_match(job: Job, req: NameCityMatchRequest, ip_hash: str) -> None:
    job.status = JobStatus.running
    t0 = time.monotonic()
    try:
        _send(job, {"type": "stage", "message": "Loading files…"})
        df_a = get_dataframe(req.file_a_id)
        df_b = get_dataframe(req.file_b_id)

        for col, df, label in [
            (req.col_name_a, df_a, "File A"), (req.col_city_a, df_a, "File A"),
            (req.col_name_b, df_b, "File B"), (req.col_city_b, df_b, "File B"),
        ]:
            if col not in df.columns:
                raise ValueError(f"Column '{col}' not found in {label}.")

        _send(job, {"type": "stage", "message": "Building index…"})

        def cb(current: int, total: int, stage: str) -> None:
            _send(job, {"type": "progress", "current": current, "total": total, "stage": stage})

        results = await match_names_with_city(
            df_a[req.col_name_a].fillna("").tolist(),
            df_a[req.col_city_a].fillna("").tolist(),
            df_b[req.col_name_b].fillna("").tolist(),
            df_b[req.col_city_b].fillna("").tolist(),
            req.threshold, cb,
        )
        _send(job, {"type": "stage", "message": "Finalizing…"})
        _finish(
            job, df_a,
            [r[0] for r in results], [r[2] for r in results],
            req.threshold, "name_city_match", time.monotonic() - t0,
            {"file_a_rows": len(df_a), "file_b_rows": len(df_b),
             "file_a_name": req.file_a_name, "file_b_name": req.file_b_name,
             "client_ip_hash": ip_hash},
            label="Match_Name",
            match_cities=[r[1] for r in results],
            extra_b_data=_extract_extra_cols(df_b, [r[3] for r in results], req.extra_cols_b),
        )
    except Exception as exc:
        job.status = JobStatus.error
        job.error = str(exc)
        _send(job, {"type": "error", "message": str(exc)})
    finally:
        release_file(req.file_a_id)
        release_file(req.file_b_id)


async def _run_id_match(job: Job, req: IdMatchRequest, ip_hash: str) -> None:
    job.status = JobStatus.running
    t0 = time.monotonic()
    try:
        _send(job, {"type": "stage", "message": "Loading files…"})
        df_a = get_dataframe(req.file_a_id)
        df_b = get_dataframe(req.file_b_id)

        for col, df, label in [
            (req.col_id_a, df_a, "File A"),
            (req.col_id_b, df_b, "File B"),
            (req.col_label_b, df_b, "File B"),
        ]:
            if col not in df.columns:
                raise ValueError(f"Column '{col}' not found in {label}.")

        _send(job, {"type": "stage", "message": "Matching IDs…"})

        def cb(current: int, total: int, stage: str) -> None:
            _send(job, {"type": "progress", "current": current, "total": total, "stage": stage})

        results = await match_ids(
            df_a[req.col_id_a].fillna(""),
            df_b[req.col_id_b].fillna(""),
            req.col_label_b, df_b, cb,
        )
        _send(job, {"type": "stage", "message": "Finalizing…"})
        # ID match: threshold is always 100 (exact only), use 100 for highlight logic
        _finish(
            job, df_a,
            [r[0] for r in results], [r[1] for r in results],
            100, "id_match", time.monotonic() - t0,
            {"file_a_rows": len(df_a), "file_b_rows": len(df_b),
             "file_a_name": req.file_a_name, "file_b_name": req.file_b_name,
             "client_ip_hash": ip_hash},
            extra_b_data=_extract_extra_cols(df_b, [r[2] for r in results], req.extra_cols_b),
        )
    except Exception as exc:
        job.status = JobStatus.error
        job.error = str(exc)
        _send(job, {"type": "error", "message": str(exc)})
    finally:
        release_file(req.file_a_id)
        release_file(req.file_b_id)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/match/start/name", response_model=StartResponse)
async def start_name_match(req: NameMatchRequest, request: Request) -> StartResponse:
    job = Job(id=str(uuid.uuid4()))
    _jobs[job.id] = job
    asyncio.create_task(_run_name_match(job, req, _ip_hash(request)))
    return StartResponse(job_id=job.id)


@router.post("/match/start/city", response_model=StartResponse)
async def start_name_city_match(req: NameCityMatchRequest, request: Request) -> StartResponse:
    job = Job(id=str(uuid.uuid4()))
    _jobs[job.id] = job
    asyncio.create_task(_run_name_city_match(job, req, _ip_hash(request)))
    return StartResponse(job_id=job.id)


@router.post("/match/start/id", response_model=StartResponse)
async def start_id_match(req: IdMatchRequest, request: Request) -> StartResponse:
    job = Job(id=str(uuid.uuid4()))
    _jobs[job.id] = job
    asyncio.create_task(_run_id_match(job, req, _ip_hash(request)))
    return StartResponse(job_id=job.id)


@router.get("/match/{job_id}/progress")
async def match_progress(job_id: str) -> StreamingResponse:
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")

    async def event_stream():
        timeout_at = time.monotonic() + 300
        while True:
            if time.monotonic() > timeout_at:
                yield "data: " + json.dumps({"type": "error", "message": "Job timed out."}) + "\n\n"
                break
            try:
                event = await asyncio.wait_for(job.events.get(), timeout=2.0)
                yield "data: " + json.dumps(event) + "\n\n"
                if event.get("type") in ("complete", "error"):
                    break
            except asyncio.TimeoutError:
                yield ": ping\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/match/{job_id}/download")
async def download_result(job_id: str) -> Response:
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status != JobStatus.complete:
        raise HTTPException(status_code=409, detail="Job not complete yet.")
    if job.result_bytes is None:
        raise HTTPException(status_code=500, detail="Result not available.")

    return Response(
        content=job.result_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{job.result_filename}"'},
    )
