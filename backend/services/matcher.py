"""
Matching pipeline: TF-IDF candidate filtering → RapidFuzz token_sort_ratio scoring.
Never runs a full N×M comparison matrix.
"""
from __future__ import annotations

import asyncio
from typing import AsyncIterator, Callable

import numpy as np
import pandas as pd
from rapidfuzz import fuzz
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from services.normalizer import normalize, normalize_org_number

TOP_N = 10  # TF-IDF candidates per row before RapidFuzz re-ranking


def _build_tfidf(values_b: list[str]) -> tuple[TfidfVectorizer, np.ndarray]:
    vectorizer = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(2, 4),
        min_df=1,
        dtype=np.float32,
    )
    matrix = vectorizer.fit_transform(values_b)
    return vectorizer, matrix


async def match_names(
    values_a: list[str],
    values_b: list[str],
    threshold: int,
    progress_cb: Callable[[int, int, str], None] | None = None,
) -> list[tuple[str, int]]:
    """
    Returns list of (best_match_value_from_b, score) for each value in values_a.
    Runs blocking CPU work in the default executor to avoid blocking the event loop.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        _match_names_sync,
        values_a,
        values_b,
        threshold,
        progress_cb,
    )


def _match_names_sync(
    values_a: list[str],
    values_b: list[str],
    threshold: int,
    progress_cb: Callable[[int, int, str], None] | None,
) -> list[tuple[str, int]]:
    norm_a = [normalize(v) for v in values_a]
    norm_b = [normalize(v) for v in values_b]

    if progress_cb:
        progress_cb(0, len(values_a), "building_index")

    vectorizer, matrix_b = _build_tfidf(norm_b)

    if progress_cb:
        progress_cb(0, len(values_a), "matching")

    results: list[tuple[str, int]] = []

    for i, (raw_a, norm) in enumerate(zip(values_a, norm_a)):
        if not norm:
            results.append(("", 0))
        else:
            vec_a = vectorizer.transform([norm])
            sims = cosine_similarity(vec_a, matrix_b).flatten()
            top_indices = np.argpartition(sims, -min(TOP_N, len(sims)))[-min(TOP_N, len(sims)):]

            best_value = ""
            best_score = 0
            for idx in top_indices:
                candidate_raw = values_b[idx]
                candidate_norm = norm_b[idx]
                score = fuzz.token_sort_ratio(norm, candidate_norm)
                if score > best_score:
                    best_score = score
                    best_value = candidate_raw

            results.append((best_value, best_score))

        if progress_cb and (i + 1) % 100 == 0:
            progress_cb(i + 1, len(values_a), "matching")

    return results


async def match_org_numbers(
    series_a: pd.Series,
    series_b: pd.Series,
    col_name_b: str,
    df_b: pd.DataFrame,
    progress_cb: Callable[[int, int, str], None] | None = None,
) -> list[tuple[str, int]]:
    """Exact org number match. Score 100 on hit, 0 on miss."""
    norm_b = {normalize_org_number(str(v)): df_b[col_name_b].iloc[i]
              for i, v in enumerate(series_b)}

    results: list[tuple[str, int]] = []
    total = len(series_a)
    for i, raw in enumerate(series_a):
        key = normalize_org_number(str(raw))
        if key in norm_b:
            results.append((norm_b[key], 100))
        else:
            results.append(("", 0))

        if progress_cb and (i + 1) % 500 == 0:
            progress_cb(i + 1, total, "matching")
        # yield control every 500 rows
        if (i + 1) % 500 == 0:
            await asyncio.sleep(0)

    return results
