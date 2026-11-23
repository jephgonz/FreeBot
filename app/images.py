"""
images.py — Helpers for generated / received images.

* Generated images are saved to ../generated_images/*.png (never kept as giant
  base64 text in chat history).
* Chat history stores a short marker:  [[image:<path-or-url>]]
* Anything that goes to the LLM is scrubbed of image blobs (see for_llm()).
"""

from __future__ import annotations

import base64
import binascii
import os
import re
import time
import uuid
from io import BytesIO
from typing import Optional, Union

from PIL import Image as PILImage

IMAGES_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "generated_images"
)

_MARKER_RE = re.compile(r"\[\[image:(.+?)\]\]", re.DOTALL)
_MD_IMG_RE = re.compile(r"!\[[^\]]*\]\(([^)\s]+)\)")
_DATA_URI_RE = re.compile(r"data:image/[\w.+-]+;base64,[A-Za-z0-9+/=\s]+")
_URL_RE = re.compile(r"https?://\S+\.(?:png|jpe?g|gif|webp)(?:\?\S*)?", re.I)


def marker(ref: str) -> str:
    return f"[[image:{ref}]]"


def _decode_data_uri(data_uri: str) -> bytes:
    b64 = data_uri.split(",", 1)[1]
    b64 = re.sub(r"\s+", "", b64)
    b64 += "=" * (-len(b64) % 4)  # tolerate missing padding
    return base64.b64decode(b64)


def save_data_uri(data_uri: str) -> str:
    """Decode a data URI, validate it with Pillow, save as PNG, return the path."""
    raw = _decode_data_uri(data_uri)
    img = PILImage.open(BytesIO(raw))
    img.load()
    if img.mode not in ("RGB", "RGBA", "L", "LA"):
        img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
    os.makedirs(IMAGES_DIR, exist_ok=True)
    path = os.path.abspath(
        os.path.join(IMAGES_DIR, f"img_{time.strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.png")
    )
    img.save(path, format="PNG")
    return path


def to_ref(src: str) -> Optional[str]:
    """Turn a data URI / URL / file path into a storable reference (or None if unusable)."""
    src = (src or "").strip()
    if src.startswith("data:image/"):
        try:
            return save_data_uri(src)
        except (ValueError, binascii.Error, OSError):
            return None
    if src.startswith(("http://", "https://")):
        return src
    if os.path.isfile(src):
        return os.path.abspath(src)
    return None


def find_image(text: str) -> tuple[Optional[str], str]:
    """Find an image in a message. Returns (ref, matched_text) or (None, "")."""
    if not isinstance(text, str):
        return None, ""
    for rx in (_MARKER_RE, _MD_IMG_RE, _DATA_URI_RE, _URL_RE):
        m = rx.search(text)
        if not m:
            continue
        candidate = m.group(1) if rx in (_MARKER_RE, _MD_IMG_RE) else m.group(0)
        ref = to_ref(candidate)
        if ref:
            return ref, m.group(0)
    return None, ""


def flet_src(ref: str) -> Union[str, bytes]:
    """What to give ft.Image(src=...). Local files are read as bytes so Flet
    doesn't have to resolve a filesystem path; URLs are passed through."""
    if ref.startswith(("http://", "https://")):
        return ref
    with open(ref, "rb") as f:
        return f.read()


def is_local(ref: str) -> bool:
    return not ref.startswith(("http://", "https://"))


def strip_blobs(text: str) -> str:
    """Replace image data (even truncated base64) and markers with a short tag."""
    if not isinstance(text, str):
        text = str(text)
    text = _MARKER_RE.sub("🖼️ [image]", text)
    text = _DATA_URI_RE.sub("🖼️ [image]", text)
    return text


def for_llm(text: str, limit: int = 6000) -> str:
    """Sanitize a history message before sending it to the model."""
    text = strip_blobs(text)
    return text if len(text) <= limit else text[:limit] + "…"
