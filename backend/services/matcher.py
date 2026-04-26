"""
Matching pipeline: TF-IDF candidate filtering → RapidFuzz token_sort_ratio scoring.
Never runs a full N×M comparison matrix.
"""
from __future__ import annotations

import asyncio
from typing import Callable

import numpy as np
import pandas as pd
from rapidfuzz import fuzz
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from services.normalizer import normalize, normalize_id

TOP_N = 10  # TF-IDF candidates per row before RapidFuzz re-ranking

NAME_WEIGHT = 0.75
CITY_WEIGHT = 0.25


def _build_tfidf(values_b: list[str]) -> tuple[TfidfVectorizer, np.ndarray]:
    vectorizer = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(2, 4),
        min_df=1,
        dtype=np.float32,
    )
    matrix = vectorizer.fit_transform(values_b)
    return vectorizer, matrix


# ── Name-only matching ────────────────────────────────────────────────────────

async def match_names(
    values_a: list[str],
    values_b: list[str],
    threshold: int,
    progress_cb: Callable[[int, int, str], None] | None = None,
) -> list[tuple[str, int]]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None, _match_names_sync, values_a, values_b, threshold, progress_cb,
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
            k = min(TOP_N, len(sims))
            top_indices = np.argpartition(sims, -k)[-k:]

            best_value = ""
            best_score = 0
            for idx in top_indices:
                score = round(fuzz.token_sort_ratio(norm, norm_b[idx]))
                if score > best_score:
                    best_score = score
                    best_value = values_b[idx]

            results.append((best_value, best_score))

        if progress_cb and (i + 1) % 100 == 0:
            progress_cb(i + 1, len(values_a), "matching")

    return results


# ── Name + City matching ──────────────────────────────────────────────────────

async def match_names_with_city(
    names_a: list[str],
    cities_a: list[str],
    names_b: list[str],
    cities_b: list[str],
    threshold: int,
    progress_cb: Callable[[int, int, str], None] | None = None,
) -> list[tuple[str, str, int]]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        _match_names_city_sync,
        names_a, cities_a, names_b, cities_b, threshold, progress_cb,
    )


def _match_names_city_sync(
    names_a: list[str],
    cities_a: list[str],
    names_b: list[str],
    cities_b: list[str],
    threshold: int,
    progress_cb: Callable[[int, int, str], None] | None,
) -> list[tuple[str, str, int]]:
    norm_names_a = [normalize(v) for v in names_a]
    norm_names_b = [normalize(v) for v in names_b]
    norm_cities_a = [normalize(v) for v in cities_a]
    norm_cities_b = [normalize(v) for v in cities_b]

    if progress_cb:
        progress_cb(0, len(names_a), "building_index")

    # TF-IDF index built on names only (city used only during re-ranking)
    vectorizer, matrix_b = _build_tfidf(norm_names_b)

    if progress_cb:
        progress_cb(0, len(names_a), "matching")

    results: list[tuple[str, str, int]] = []

    for i, norm_name in enumerate(norm_names_a):
        if not norm_name:
            results.append(("", "", 0))
        else:
            vec_a = vectorizer.transform([norm_name])
            sims = cosine_similarity(vec_a, matrix_b).flatten()
            k = min(TOP_N, len(sims))
            top_indices = np.argpartition(sims, -k)[-k:]

            best_name = ""
            best_city = ""
            best_score = 0
            for idx in top_indices:
                name_score = fuzz.token_sort_ratio(norm_name, norm_names_b[idx])
                city_score = fuzz.ratio(norm_cities_a[i], norm_cities_b[idx])
                combined = round(NAME_WEIGHT * name_score + CITY_WEIGHT * city_score)
                if combined > best_score:
                    best_score = combined
                    best_name = names_b[idx]
                    best_city = cities_b[idx]

            results.append((best_name, best_city, best_score))

        if progress_cb and (i + 1) % 100 == 0:
            progress_cb(i + 1, len(names_a), "matching")

    return results


# ── Exact ID matching ─────────────────────────────────────────────────────────

async def match_ids(
    ids_a: pd.Series,
    ids_b: pd.Series,
    label_col_b: str,
    df_b: pd.DataFrame,
    progress_cb: Callable[[int, int, str], None] | None = None,
) -> list[tuple[str, int]]:
    """Exact ID match (org numbers, ISRCs, customer IDs, …). Score 100/0."""
    lookup = {
        normalize_id(str(v)): df_b[label_col_b].iloc[i]
        for i, v in enumerate(ids_b)
    }

    results: list[tuple[str, int]] = []
    total = len(ids_a)
    for i, raw in enumerate(ids_a):
        key = normalize_id(str(raw))
        results.append((lookup[key], 100) if key in lookup else ("", 0))

        if progress_cb and (i + 1) % 500 == 0:
            progress_cb(i + 1, total, "matching")
        if (i + 1) % 500 == 0:
            await asyncio.sleep(0)

    return results
