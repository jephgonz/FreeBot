"""
gateway.py — Client for the freeLLMapi local gateway.

This module is the only place that knows how to reach the LLM gateway.
It exposes a small, async API used by the UI layer:

    list_models(base_url, api_key) -> list[dict]
    chat_stream(base_url, api_key, model, messages, temperature) -> AsyncIterator[str]

The gateway is OpenAI-compatible (freellmapi exposes an OpenAI-shaped
/v1/chat/completions endpoint), so we speak that wire protocol with httpx.
Streaming is preferred: the UI renders tokens as they arrive.
"""

from __future__ import annotations

import json
from typing import AsyncIterator

import httpx


class GatewayError(Exception):
    """Raised when the gateway cannot be reached or returns an error."""


def normalize_base_url(base_url: str) -> str:
    """Make sure the configured base URL looks like an OpenAI-style endpoint root.

    Accepts any of:
        http://127.0.0.1:8000
        http://127.0.0.1:8000/v1
        http://127.0.0.1:8000/v1/
    and always returns the trailing-slash-stripped form without a trailing /v1
    suffix duplication. We keep the trailing part as-is but ensure the final
    result ends without a slash so we can append /models and /chat/completions.
    """
    url = (base_url or "").strip().rstrip("/")
    if not url:
        url = "http://127.0.0.1:8000/v1"
    # If the user typed a bare host with no version segment, append /v1 for them.
    # Check if URL already has /v1 as a path segment (not part of another version like v11, v12).
    # We look for /v1 at the end, or /v1/ in the middle, or /v1? for query params.
    # Using a more precise check: split by / and check if 'v1' is a path segment.
    from urllib.parse import urlparse
    parsed = urlparse(url)
    path_segments = [s for s in parsed.path.split('/') if s]
    has_v1_segment = 'v1' in path_segments
    if not has_v1_segment:
        url = f"{url}/v1"
    # If URL ends with /v1/ (trailing slash after v1), strip the trailing slash
    url = url.rstrip("/")
    return url


def _headers(api_key: str) -> dict[str, str]:
    h = {"Content-Type": "application/json"}
    if api_key:
        h["Authorization"] = f"Bearer {api_key}"
    return h


async def list_models(base_url: str, api_key: str, timeout: float = 10.0) -> list[dict]:
    """Return the list of models advertised by the gateway.

    Each item is a dict with at least an ``id`` and an ``object`` key. The
    gateway may also return a legacy list of strings; we tolerate both.
    """
    url = f"{normalize_base_url(base_url)}/models"
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url, headers=_headers(api_key))
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        raise GatewayError(f"Gateway returned HTTP {exc.response.status_code}") from exc
    except (httpx.TransportError, httpx.TimeoutException) as exc:
        raise GatewayError(f"Cannot reach gateway at {url} ({exc})") from exc
    except (json.JSONDecodeError, ValueError) as exc:
        raise GatewayError("Gateway response was not valid JSON") from exc

    raw = data.get("data", [])
    models: list[dict] = []
    for item in raw:
        if isinstance(item, str):
            models.append({"id": item, "object": "model"})
        elif isinstance(item, dict) and "id" in item:
            models.append(item)
    return models


async def chat_stream(
    base_url: str,
    api_key: str,
    model: str,
    messages: list[dict],
    temperature: float = 0.7,
    timeout: float = 120.0,
) -> AsyncIterator[str]:
    """Stream a chat completion from the gateway.

    Yields the incremental content delta as plain text. Raises GatewayError on
    connection problems, HTTP errors, or a non-streaming error payload.

    This is an async generator, so callers consume it with ``async for``.
    """
    url = f"{normalize_base_url(base_url)}/chat/completions"
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "stream": True,
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST", url, json=payload, headers=_headers(api_key)
            ) as resp:
                if resp.status_code != 200:
                    body = await resp.aread()
                    raise GatewayError(
                        f"Gateway error {resp.status_code}: {body.decode(errors='replace')[:300]}"
                    )
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    chunk = line[len("data:"):].strip()
                    if chunk == "[DONE]":
                        break
                    try:
                        delta = json.loads(chunk)
                    except json.JSONDecodeError:
                        continue
                    # Non-streaming error object may arrive inside a data chunk.
                    if "error" in delta:
                        raise GatewayError(str(delta["error"]))
                    for choice in delta.get("choices", []):
                        content = (
                            choice.get("delta", {}).get("content")
                            or choice.get("message", {}).get("content")
                            or ""
                        )
                        if content:
                            yield content
    except GatewayError:
        raise
    except httpx.TimeoutException as exc:
        raise GatewayError("Gateway timed out while streaming") from exc
    except httpx.TransportError as exc:
        raise GatewayError(f"Cannot reach gateway at {url} ({exc})") from exc
