from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from .models import Listing


def load_state(path: Path) -> dict:
    if not path.exists():
        return {"version": 1, "seen": {}}
    with path.open("r", encoding="utf-8") as handle:
        state = json.load(handle)
    state.setdefault("version", 1)
    state.setdefault("seen", {})
    return state


def save_state(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(state, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write("\n")


def is_seen(state: dict, listing: Listing) -> bool:
    return listing.id in state.get("seen", {})


def mark_seen(state: dict, listings: list[Listing]) -> None:
    seen = state.setdefault("seen", {})
    now = datetime.now(timezone.utc).isoformat()
    for listing in listings:
        seen.setdefault(
            listing.id,
            {
                "first_seen": now,
                "source": listing.source_name,
                "title": listing.title,
                "url": listing.url,
            },
        )

