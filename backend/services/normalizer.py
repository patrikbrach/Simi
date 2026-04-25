import re
import unicodedata

STOPWORDS = {
    "the", "a", "an",
    "och", "ab", "hb", "kb", "inc", "ltd", "group", "&",
}

_PUNCT_RE = re.compile(r"[^\w\s]", re.UNICODE)
_SPACE_RE = re.compile(r"\s+")


def normalize(text: str) -> str:
    if not isinstance(text, str):
        text = str(text) if text is not None else ""

    # Unicode normalization (NFC)
    text = unicodedata.normalize("NFC", text)
    text = text.lower().strip()

    # Remove punctuation
    text = _PUNCT_RE.sub(" ", text)

    # Remove stopwords
    tokens = _SPACE_RE.split(text)
    tokens = [t for t in tokens if t and t not in STOPWORDS]

    return " ".join(tokens)


def normalize_id(value: str) -> str:
    """Strip whitespace, hyphens and dots — works for org numbers, ISRCs, IDs, etc."""
    if not isinstance(value, str):
        value = str(value) if value is not None else ""
    return re.sub(r"[\s\-\.]", "", value).strip()


# Keep old name as alias for backwards compatibility
normalize_org_number = normalize_id
