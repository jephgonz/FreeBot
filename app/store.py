"""
store.py — Persistent configuration for the app.

FreeLLMapi style setup: you may have several API keys (different providers,
different accounts, each with its own token/rate budget). This module keeps
them in a small JSON file next to the app, and provides thread-safe helpers
to read and write them from the Flet UI thread.
"""

from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass, field
from typing import Any, Optional

CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "config.json"
)

_lock = threading.Lock()


@dataclass
class ApiKey:
    """A single free-LLM API key entry."""

    label: str
    key: str
    base_url: str = "http://127.0.0.1:8000/v1"
    provider: str = "free"
    note: str = ""
    enabled: bool = True


@dataclass
class Bot:
    """A bot that uses a specific API key + model."""

    name: str
    api_key_label: str = ""
    model: str = ""
    system_prompt: str = "You are a helpful assistant."
    temperature: float = 0.7
    color: str = "#1f6feb"


@dataclass
class Settings:
    base_url: str = "http://127.0.0.1:8000/v1"
    api_keys: list[ApiKey] = field(default_factory=list)
    bots: list[Bot] = field(default_factory=list)
    last_bot: str = ""


def _load() -> dict[str, Any]:
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def _save(data: dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    tmp = CONFIG_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, CONFIG_PATH)


def load_settings() -> Settings:
    data = _load()
    s = Settings(
        base_url=data.get("base_url", "http://127.0.0.1:8000/v1"),
        last_bot=data.get("last_bot", ""),
    )
    for k in data.get("api_keys", []):
        s.api_keys.append(
            ApiKey(
                label=k.get("label", "key"),
                key=k.get("key", ""),
                base_url=k.get("base_url", s.base_url),
                provider=k.get("provider", "free"),
                note=k.get("note", ""),
                enabled=k.get("enabled", True),
            )
        )
    for b in data.get("bots", []):
        s.bots.append(
            Bot(
                name=b.get("name", "Bot"),
                api_key_label=b.get("api_key_label", ""),
                model=b.get("model", ""),
                system_prompt=b.get("system_prompt", "You are a helpful assistant."),
                temperature=b.get("temperature", 0.7),
                color=b.get("color", "#1f6feb"),
            )
        )
    return s


def save_settings(s: Settings) -> None:
    data = {
        "base_url": s.base_url,
        "last_bot": s.last_bot,
        "api_keys": [
            {
                "label": k.label,
                "key": k.key,
                "base_url": k.base_url,
                "provider": k.provider,
                "note": k.note,
                "enabled": k.enabled,
            }
            for k in s.api_keys
        ],
        "bots": [
            {
                "name": b.name,
                "api_key_label": b.api_key_label,
                "model": b.model,
                "system_prompt": b.system_prompt,
                "temperature": b.temperature,
                "color": b.color,
            }
            for b in s.bots
        ],
    }
    with _lock:
        _save(data)


def get_key(settings: Settings, label: str) -> Optional[ApiKey]:
    for k in settings.api_keys:
        if k.label == label and k.enabled:
            return k
    return None


def upsert_key(settings: Settings, key: ApiKey) -> None:
    for i, k in enumerate(settings.api_keys):
        if k.label == key.label:
            settings.api_keys[i] = key
            return
    settings.api_keys.append(key)


def remove_key(settings: Settings, label: str) -> None:
    settings.api_keys[:] = [k for k in settings.api_keys if k.label != label]


def upsert_bot(settings: Settings, bot: Bot) -> None:
    for i, b in enumerate(settings.bots):
        if b.name == bot.name:
            settings.bots[i] = bot
            return
    settings.bots.append(bot)


def remove_bot(settings: Settings, name: str) -> None:
    settings.bots[:] = [b for b in settings.bots if b.name != name]
