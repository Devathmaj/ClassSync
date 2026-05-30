import io
import csv
from typing import List, Dict, Any


def parse_csv_bytes(data: bytes) -> List[Dict[str, Any]]:
    """Parse raw CSV bytes into a list of dicts."""
    text = data.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    return [dict(row) for row in reader]


def generate_short_name(name: str, length: int = 3) -> str:
    """Auto-generate a short name from a full name."""
    words = name.upper().split()
    if len(words) == 1:
        return words[0][:length]
    return "".join(w[0] for w in words)[:length]
