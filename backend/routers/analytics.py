"""GET /api/analytics – aggregated usage analytics."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from database import get_db
from models import MatchRun

router = APIRouter()


@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)) -> dict:
    now = datetime.now(timezone.utc)
    cutoff_30d = now - timedelta(days=30)

    total_runs = db.query(func.count(MatchRun.id)).scalar() or 0
    runs_30d = (
        db.query(func.count(MatchRun.id))
        .filter(MatchRun.created_at >= cutoff_30d)
        .scalar()
        or 0
    )

    # Use-case distribution
    use_case_rows = (
        db.query(MatchRun.use_case, func.count(MatchRun.id).label("cnt"))
        .group_by(MatchRun.use_case)
        .all()
    )
    use_case_dist = {row.use_case: row.cnt for row in use_case_rows}

    # Average score over time (by day, last 60 days)
    cutoff_60d = now - timedelta(days=60)
    score_trend_rows = (
        db.query(
            func.date(MatchRun.created_at).label("day"),
            func.avg(MatchRun.avg_match_score).label("avg_score"),
        )
        .filter(MatchRun.created_at >= cutoff_60d)
        .group_by(func.date(MatchRun.created_at))
        .order_by(func.date(MatchRun.created_at))
        .all()
    )
    score_trend = [
        {"day": str(row.day), "avg_score": round(row.avg_score or 0, 1)}
        for row in score_trend_rows
    ]

    # Processing time by row-count bucket (A rows)
    proc_time_rows = db.query(
        MatchRun.file_a_rows,
        MatchRun.processing_time_sec,
    ).all()

    def _bucket(n: int | None) -> str:
        if n is None:
            return "unknown"
        if n < 1000:
            return "0-1k"
        if n < 5000:
            return "1k-5k"
        if n < 10000:
            return "5k-10k"
        if n < 20000:
            return "10k-20k"
        return "20k+"

    bucket_totals: dict[str, list[float]] = {}
    for row in proc_time_rows:
        b = _bucket(row.file_a_rows)
        bucket_totals.setdefault(b, []).append(row.processing_time_sec or 0)
    proc_time_by_bucket = {
        b: round(sum(v) / len(v), 2) for b, v in bucket_totals.items()
    }

    # Threshold distribution
    threshold_rows = (
        db.query(MatchRun.threshold, func.count(MatchRun.id).label("cnt"))
        .group_by(MatchRun.threshold)
        .order_by(MatchRun.threshold)
        .all()
    )
    threshold_dist = [{"threshold": row.threshold, "count": row.cnt} for row in threshold_rows]

    return {
        "total_runs": total_runs,
        "runs_last_30_days": runs_30d,
        "use_case_distribution": use_case_dist,
        "score_trend": score_trend,
        "processing_time_by_bucket": proc_time_by_bucket,
        "threshold_distribution": threshold_dist,
    }
