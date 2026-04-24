"""
POST /api/match/start       – queue a match job, return job_id
GET  /api/match/{id}/progress – SSE stream of progress events
GET  /api/match/{id}/download – download the result Excel file
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import AsyncIterator

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import SessionLocal
from routers.upload import get_dataframe, release_file
from services.excel_writer import build_result_excel, result_filename
from services.matcher import match_names, match_org_numbers

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


# ── Request / Response schemas ────────────────────────────────────────────────

class NameMatchRequest(BaseModel):
    file_a_id: str
    file_b_id: str
    column_a: str
    column_b: str
    threshold: int = 85
    file_a_name: str = ""
    file_b_name: str = ""


class CompanyMatchRequest(BaseModel):
    file_a_id: str
    file_b_id: str
    # company name columns (required for fuzzy branch)
    col_name_a: str
    col_name_b: str
    # org number columns (optional)
    col_org_a: str = ""
    col_org_b: str = ""
    use_org_match: bool = False
    threshold: int = 85
    file_a_name: str = ""
    file_b_name: str = ""


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


# ── Name match background task ────────────────────────────────────────────────

async def _run_name_match(job: Job, req: NameMatchRequest, ip_hash: str) -> None:
    job.status = JobStatus.running
    t0 = time.monotonic()
    try:
        _send(job, {"type": "stage", "message": "Loading files…"})
        df_a = get_dataframe(req.file_a_id)
        df_b = get_dataframe(req.file_b_id)

        if req.column_a not in df_a.columns:
            raise ValueError(f"Column '{req.column_a}' not found in File A.")
        if req.column_b not in df_b.columns:
            raise ValueError(f"Column '{req.column_b}' not found in File B.")

        values_a = df_a[req.column_a].fillna("").tolist()
        values_b = df_b[req.column_b].fillna("").tolist()

        _send(job, {"type": "stage", "message": "Building TF-IDF index…"})

        last_progress = {"current": 0}

        def progress_cb(current: int, total: int, stage: str) -> None:
            last_progress["current"] = current
            _send(job, {"type": "progress", "current": current, "total": total, "stage": stage})

        results = await match_names(values_a, values_b, req.threshold, progress_cb)

        _send(job, {"type": "stage", "message": "Finalizing…"})

        match_values = [r[0] for r in results]
        match_scores = [r[1] for r in results]

        elapsed = time.monotonic() - t0
        above = sum(1 for s in match_scores if s >= req.threshold)
        avg = sum(match_scores) / len(match_scores) if match_scores else 0.0
        exact = sum(1 for s in match_scores if s == 100)

        job.result_bytes = build_result_excel(df_a, match_values, match_scores, req.threshold)
        job.result_filename = result_filename()
        job.status = JobStatus.complete

        stats = {
            "matches": above,
            "total": len(values_a),
            "avg_score": round(avg, 1),
            "exact_matches": exact,
            "processing_time_sec": round(elapsed, 2),
        }
        _send(job, {"type": "complete", "stats": stats})

        _log_run("name_match", {
            "file_a_rows": len(df_a),
            "file_b_rows": len(df_b),
            "file_a_name": req.file_a_name,
            "file_b_name": req.file_b_name,
            "threshold": req.threshold,
            "processing_time_sec": elapsed,
            "matches_above_threshold": above,
            "avg_match_score": avg,
            "exact_matches": exact,
            "client_ip_hash": ip_hash,
        })

        release_file(req.file_a_id)
        release_file(req.file_b_id)

    except Exception as exc:
        job.status = JobStatus.error
        job.error = str(exc)
        _send(job, {"type": "error", "message": str(exc)})


# ── Company match background task ─────────────────────────────────────────────

async def _run_company_match(job: Job, req: CompanyMatchRequest, ip_hash: str) -> None:
    job.status = JobStatus.running
    t0 = time.monotonic()
    try:
        _send(job, {"type": "stage", "message": "Loading files…"})
        df_a = get_dataframe(req.file_a_id)
        df_b = get_dataframe(req.file_b_id)

        def progress_cb(current: int, total: int, stage: str) -> None:
            _send(job, {"type": "progress", "current": current, "total": total, "stage": stage})

        if req.use_org_match:
            if not req.col_org_a or not req.col_org_b:
                raise ValueError("Org number columns must be specified for org match.")
            _send(job, {"type": "stage", "message": "Matching organisation numbers…"})
            results = await match_org_numbers(
                df_a[req.col_org_a].fillna(""),
                df_b[req.col_org_b].fillna(""),
                req.col_name_b,
                df_b,
                progress_cb,
            )
            use_case = "company_org"
        else:
            _send(job, {"type": "stage", "message": "Building TF-IDF index…"})
            values_a = df_a[req.col_name_a].fillna("").tolist()
            values_b = df_b[req.col_name_b].fillna("").tolist()
            results = await match_names(values_a, values_b, req.threshold, progress_cb)
            use_case = "company_name"

        _send(job, {"type": "stage", "message": "Finalizing…"})

        match_values = [r[0] for r in results]
        match_scores = [r[1] for r in results]

        elapsed = time.monotonic() - t0
        above = sum(1 for s in match_scores if s >= req.threshold)
        avg = sum(match_scores) / len(match_scores) if match_scores else 0.0
        exact = sum(1 for s in match_scores if s == 100)

        job.result_bytes = build_result_excel(
            df_a, match_values, match_scores, req.threshold, label="Match_Company_Name"
        )
        job.result_filename = result_filename()
        job.status = JobStatus.complete

        stats = {
            "matches": above,
            "total": len(df_a),
            "avg_score": round(avg, 1),
            "exact_matches": exact,
            "processing_time_sec": round(elapsed, 2),
        }
        _send(job, {"type": "complete", "stats": stats})

        _log_run(use_case, {
            "file_a_rows": len(df_a),
            "file_b_rows": len(df_b),
            "file_a_name": req.file_a_name,
            "file_b_name": req.file_b_name,
            "threshold": req.threshold,
            "processing_time_sec": elapsed,
            "matches_above_threshold": above,
            "avg_match_score": avg,
            "exact_matches": exact,
            "client_ip_hash": ip_hash,
        })

        release_file(req.file_a_id)
        release_file(req.file_b_id)

    except Exception as exc:
        job.status = JobStatus.error
        job.error = str(exc)
        _send(job, {"type": "error", "message": str(exc)})


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/match/start/name", response_model=StartResponse)
async def start_name_match(req: NameMatchRequest, request: Request) -> StartResponse:
    job = Job(id=str(uuid.uuid4()))
    _jobs[job.id] = job
    asyncio.create_task(_run_name_match(job, req, _ip_hash(request)))
    return StartResponse(job_id=job.id)


@router.post("/match/start/company", response_model=StartResponse)
async def start_company_match(req: CompanyMatchRequest, request: Request) -> StartResponse:
    job = Job(id=str(uuid.uuid4()))
    _jobs[job.id] = job
    asyncio.create_task(_run_company_match(job, req, _ip_hash(request)))
    return StartResponse(job_id=job.id)


@router.get("/match/{job_id}/progress")
async def match_progress(job_id: str) -> StreamingResponse:
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")

    async def event_stream() -> AsyncIterator[str]:
        timeout_at = time.monotonic() + 300  # 5-minute hard limit
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
                # Keep-alive ping
                yield ": ping\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
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
