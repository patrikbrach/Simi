"""
POST /api/upload – Accept an Excel/CSV file, return column names + preview rows.
Files are stored in memory (no disk persistence needed at this stage).
"""
from __future__ import annotations

import io
import uuid

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel

router = APIRouter()

# In-memory store: file_id → DataFrame
_file_store: dict[str, pd.DataFrame] = {}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_EXTENSIONS = {".xlsx", ".xls", ".csv"}


class UploadResponse(BaseModel):
    file_id: str
    filename: str
    columns: list[str]
    preview: list[dict]
    row_count: int


@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile) -> UploadResponse:
    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB limit.")

    filename = file.filename or ""
    ext = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type '{ext}'. Accepted: .xlsx, .xls, .csv",
        )

    try:
        if ext == ".csv":
            df = pd.read_csv(io.BytesIO(content), dtype=str, keep_default_na=False)
        else:
            df = pd.read_excel(io.BytesIO(content), dtype=str, keep_default_na=False)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not parse file: {exc}")

    if df.empty:
        raise HTTPException(status_code=422, detail="File is empty.")

    file_id = str(uuid.uuid4())
    _file_store[file_id] = df

    preview = df.head(5).fillna("").to_dict(orient="records")

    return UploadResponse(
        file_id=file_id,
        filename=filename,
        columns=list(df.columns),
        preview=preview,
        row_count=len(df),
    )


def get_dataframe(file_id: str) -> pd.DataFrame:
    df = _file_store.get(file_id)
    if df is None:
        raise HTTPException(status_code=404, detail=f"File '{file_id}' not found or expired.")
    return df


def release_file(file_id: str) -> None:
    _file_store.pop(file_id, None)
