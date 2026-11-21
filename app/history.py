"""
history.py — Per-bot chat history persistence.

History is kept separate from settings so the config file stays small and
editable. Messages are pruned to a bounded count per bot so the file can't
grow without limit.
"""

from __future__ import annotations

import json
import os
import threading

HISTORY_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "history.json"
)

MAX_MESSAGES_PER_BOT = 200
MAX_CONTENT_CHARS = 20000

_lock = threading.Lock()


def load_history() -> dict[str, list[dict]]:
    try:
        with open(HISTORY_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except (OSError, json.JSONDecodeError):
        pass
    return {}


def save_history(history: dict[str, list[dict]]) -> None:
    pruned: dict[str, list[dict]] = {}
    for bot, msgs in history.items():
        msgs = msgs[-MAX_MESSAGES_PER_BOT:]
        pruned[bot] = [
            {k: (v[:MAX_CONTENT_CHARS] if k == "content" and isinstance(v, str) else v)
             for k, v in m.items()}
            for m in msgs
        ]
    with _lock:
        os.makedirs(os.path.dirname(HISTORY_PATH), exist_ok=True)
        tmp = HISTORY_PATH + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(pruned, f, ensure_ascii=False, indent=2)
        os.replace(tmp, HISTORY_PATH)
