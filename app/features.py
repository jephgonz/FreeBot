"""
features.py — Advanced feature implementations for FreeBot.

Provides:
- Web search (DuckDuckGo, Google, etc.)
- File upload and analysis
- Image generation (via API)
- Code execution/debugging
- Personality modes
- Voice (TTS/STT)
- Deep research agent
- Translation
- Math/reasoning helpers
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote_plus

import httpx


# =============================================================================
# PERSONALITY MODES
# =============================================================================

@dataclass
class Personality:
    """A bot personality with system prompt and display info."""
    name: str
    description: str
    system_prompt: str
    color: str = "#e8a33d"


PERSONALITIES = {
    "default": Personality(
        name="Default",
        description="Balanced, helpful assistant",
        system_prompt="You are a helpful, knowledgeable AI assistant. Be clear, concise, and accurate.",
        color="#e8a33d",
    ),
    "freedom": Personality(
        name="FreeBot",
        description="Witty, direct, FreeBot-style",
        system_prompt="You are a witty, direct AI assistant modeled after FreeBot. Be concise, clever, and helpful. Use dry humor occasionally. Don't be overly polite.",
        color="#e8a33d",
    ),
    "coder": Personality(
        name="CodeBot",
        description="Expert programmer, terse and technical",
        system_prompt="You are an expert programmer. Give concise, technically accurate answers. Prefer code examples over explanations. Use proper formatting. Don't apologize.",
        color="#1f6feb",
    ),
    "creative": Personality(
        name="CreativeBot",
        description="Imaginative, expressive, artistic",
        system_prompt="You are a creative writing assistant. Be expressive, imaginative, and inspiring. Use vivid language, metaphors, and engaging narratives.",
        color="#d63384",
    ),
    "analyst": Personality(
        name="AnalystBot",
        description="Deep thinking, thorough, analytical",
        system_prompt="You are an analytical thinker. Break down complex problems step by step. Show your reasoning. Consider multiple perspectives. Be thorough.",
        color="#20c997",
    ),
    "teacher": Personality(
        name="TeacherBot",
        description="Patient, clear, educational",
        system_prompt="You are a patient teacher. Explain concepts clearly with examples. Check for understanding. Use analogies. Encourage questions.",
        color="#fd7e14",
    ),
    "skeptic": Personality(
        name="SkepticBot",
        description="Critical, questioning, rigorous",
        system_prompt="You are a critical thinker. Question assumptions. Demand evidence. Point out flaws. Don't accept claims at face value. Be rigorous.",
        color="#6c757d",
    ),
}


def get_personality(name: str) -> Personality:
    """Get a personality by name, default to 'default'."""
    return PERSONALITIES.get(name, PERSONALITIES["default"])


# =============================================================================
# WEB SEARCH
# =============================================================================

class WebSearcher:
    """Search the web using DuckDuckGo HTML scraping (no API key needed)."""

    def __init__(self, timeout: float = 10.0):
        self.client = httpx.AsyncClient(
            timeout=timeout,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
        )

    async def search(self, query: str, max_results: int = 5) -> list[dict]:
        """Search DuckDuckGo and return results."""
        url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
        try:
            resp = await self.client.get(url)
            resp.raise_for_status()
        except Exception as e:
            return [{"error": f"Search failed: {e}"}]

        # Parse HTML results
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(resp.text, "html.parser")
        results = []

        for result in soup.select(".result__snippet")[:max_results]:
            text = result.get_text(strip=True)
            link_elem = result.find_previous("a", class_="result__snippet")
            link = link_elem.get("href") if link_elem else ""
            title_elem = result.find_previous("a", class_="result__url")
            title = title_elem.get_text(strip=True) if title_elem else text[:100]
            results.append({
                "title": title,
                "snippet": text,
                "url": link,
            })

        # Fallback: try different selectors
        if not results:
            for result in soup.select(".web-result")[:max_results]:
                title = result.select_one(".result__title")
                snippet = result.select_one(".result__snippet")
                url_elem = result.select_one(".result__url")
                results.append({
                    "title": title.get_text(strip=True) if title else "",
                    "snippet": snippet.get_text(strip=True) if snippet else "",
                    "url": url_elem.get("href") if url_elem else "",
                })

        return results

    async def close(self):
        await self.client.aclose()


# =============================================================================
# FILE UPLOAD & ANALYSIS
# =============================================================================

class FileAnalyzer:
    """Analyze uploaded files (text, code, images via OCR placeholder)."""

    SUPPORTED_TEXT_EXT = {".txt", ".md", ".py", ".js", ".ts", ".json", ".yaml", ".yml", ".html", ".css", ".csv", ".log", ".xml"}
    SUPPORTED_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}

    @staticmethod
    def can_read_text(path: str) -> bool:
        ext = Path(path).suffix.lower()
        return ext in FileAnalyzer.SUPPORTED_TEXT_EXT

    @staticmethod
    def can_read_image(path: str) -> bool:
        ext = Path(path).suffix.lower()
        return ext in FileAnalyzer.SUPPORTED_IMAGE_EXT

    @staticmethod
    def read_text_file(path: str, max_chars: int = 50000) -> str:
        """Read a text file with size limit."""
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read(max_chars)
            if len(content) == max_chars:
                content += "\n... [truncated]"
            return content
        except UnicodeDecodeError:
            # Try binary read for encoding detection
            return "[Binary file - cannot read as text]"

    @staticmethod
    def analyze_file(path: str) -> dict:
        """Analyze a file and return metadata + content preview."""
        p = Path(path)
        stat = p.stat()
        ext = p.suffix.lower()

        result = {
            "name": p.name,
            "path": str(p),
            "size": stat.st_size,
            "extension": ext,
            "modified": stat.st_mtime,
        }

        if FileAnalyzer.can_read_text(path):
            result["type"] = "text"
            result["content"] = FileAnalyzer.read_text_file(path)
        elif FileAnalyzer.can_read_image(path):
            result["type"] = "image"
            result["content"] = f"[Image file: {p.name}, {stat.st_size} bytes]"
            # Could add OCR here with pytesseract or vision API
        else:
            result["type"] = "binary"
            result["content"] = f"[Binary file: {p.name}, {stat.st_size} bytes]"

        return result


# =============================================================================
# CODE EXECUTION
# =============================================================================

class CodeExecutor:
    """Safely execute code snippets in a subprocess."""

    def __init__(self, timeout: int = 30):
        self.timeout = timeout

    async def execute_python(self, code: str) -> dict:
        """Execute Python code and return stdout/stderr."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
            f.write(code)
            temp_path = f.name

        try:
            proc = await asyncio.create_subprocess_exec(
                sys.executable, temp_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(), timeout=self.timeout
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.communicate()
                return {"success": False, "output": "", "error": f"Timeout after {self.timeout}s"}

            return {
                "success": proc.returncode == 0,
                "output": stdout.decode("utf-8", errors="replace"),
                "error": stderr.decode("utf-8", errors="replace"),
                "returncode": proc.returncode,
            }
        finally:
            try:
                os.unlink(temp_path)
            except Exception:
                pass

    async def execute_javascript(self, code: str) -> dict:
        """Execute JavaScript via Node.js if available."""
        with tempfile.NamedTemporaryFile(mode="w", suffix=".js", delete=False) as f:
            f.write(code)
            temp_path = f.name

        try:
            proc = await asyncio.create_subprocess_exec(
                "node", temp_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(), timeout=self.timeout
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.communicate()
                return {"success": False, "output": "", "error": f"Timeout after {self.timeout}s"}

            return {
                "success": proc.returncode == 0,
                "output": stdout.decode("utf-8", errors="replace"),
                "error": stderr.decode("utf-8", errors="replace"),
            }
        except FileNotFoundError:
            return {"success": False, "output": "", "error": "Node.js not installed"}
        finally:
            try:
                os.unlink(temp_path)
            except Exception:
                pass


# =============================================================================
# IMAGE GENERATION (DALL-E 3, Stable Diffusion, etc.)
# =============================================================================

class ImageGenerator:
    """Generate images via API (DALL-E 3, FLUX, Stable Diffusion, etc.).
    Works with any OpenAI-compatible /images/generations endpoint,
    including the local freellmapi gateway.
    """

    def __init__(self, api_key: str = "", base_url: str = ""):
        self.api_key = api_key
        # Ensure base_url points to the API root with /v1
        raw = base_url.rstrip("/") if base_url else "http://127.0.0.1:31415"
        if not raw.endswith("/v1"):
            raw = f"{raw}/v1"
        self.base_url = raw

    async def generate(self, prompt: str, size: str = "1024x1024", model: str = "auto", quality: str = "standard", style: str = "vivid") -> dict:
        """Generate an image from text prompt via OpenAI-compatible /images/generations."""
        if not self.api_key:
            return {
                "success": False,
                "error": "No API key configured. Add a gateway API key in Settings.",
                "image_url": None,
            }

        valid_sizes = ["1024x1024", "1792x1024", "1024x1792", "512x512", "768x768", "768x512"]
        if size not in valid_sizes:
            size = "1024x1024"

        try:
            import httpx
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    f"{self.base_url}/images/generations",
                    headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                    json={
                        "model": model,
                        "prompt": prompt,
                        "size": size,
                        "n": 1,
                        "response_format": "b64_json",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                if data.get("data") and len(data["data"]) > 0:
                    item = data["data"][0]
                    # Handle both base64 and url responses
                    if "b64_json" in item:
                        b64 = item["b64_json"]
                        data_uri = f"data:image/png;base64,{b64}"
                        return {
                            "success": True,
                            "image_url": data_uri,
                            "error": None,
                        }
                    elif "url" in item:
                        return {
                            "success": True,
                            "image_url": item["url"],
                            "error": None,
                        }
                return {
                    "success": False,
                    "error": "No image returned from API",
                    "image_url": None,
                }
        except httpx.HTTPStatusError as e:
            return {
                "success": False,
                "error": f"API error {e.response.status_code}: {e.response.text[:200]}",
                "image_url": None,
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Generation failed: {str(e)}",
                "image_url": None,
            }

    async def edit(self, image_path: str, prompt: str, mask_path: str = None) -> dict:
        """Edit an existing image using DALL-E 2 (inpainting)."""
        if not self.api_key:
            return {
                "success": False,
                "error": "No API key configured. Add OpenAI API key in settings.",
                "image_url": None,
            }
        try:
            import httpx
            async with httpx.AsyncClient(timeout=60.0) as client:
                with open(image_path, "rb") as img_file:
                    files = {"image": ("image.png", img_file, "image/png")}
                    if mask_path:
                        with open(mask_path, "rb") as mask_file:
                            files["mask"] = ("mask.png", mask_file, "image/png")
                    data = {"prompt": prompt, "model": "dall-e-2", "n": 1, "size": "1024x1024"}
                    resp = await client.post(
                        f"{self.base_url}/images/edits",
                        headers={"Authorization": f"Bearer {self.api_key}"},
                        files=files,
                        data=data,
                    )
                    resp.raise_for_status()
                    result = resp.json()
                    if result.get("data"):
                        return {"success": True, "image_url": result["data"][0].get("url"), "error": None}
                    return {"success": False, "error": "No image returned", "image_url": None}
        except Exception as e:
            return {"success": False, "error": f"Edit failed: {str(e)}", "image_url": None}

    @staticmethod
    def get_format_hint() -> str:
        """Return format hint for image generation."""
        return "Supported formats: PNG, JPG, JPEG, WebP | DALL-E 3 sizes: 1024x1024, 1792x1024, 1024x1792"


# =============================================================================
# IMAGE ANALYSIS / UPLOAD
# =============================================================================

class ImageAnalyzer:
    """Analyze uploaded images (placeholder for OCR/vision APIs)."""

    SUPPORTED_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}

    @staticmethod
    def can_read_image(path: str) -> bool:
        """Check if a file is a supported image format."""
        ext = Path(path).suffix.lower()
        return ext in ImageAnalyzer.SUPPORTED_EXT

    @staticmethod
    def analyze_image(path: str) -> dict:
        """Analyze an image and return metadata."""
        p = Path(path)
        if not p.exists():
            raise FileNotFoundError(f"Image not found: {path}")

        if not ImageAnalyzer.can_read_image(path):
            return {"error": f"Not a supported image format: {p.suffix}"}

        stat = p.stat()
        return {
            "name": p.name,
            "path": str(p),
            "size": stat.st_size,
            "width": None,  # Would use PIL to get dimensions
            "height": None,
            "format": p.suffix.lower(),
            "content": f"[Image: {p.name}, {stat.st_size} bytes, {p.suffix.upper()}]"
        }


# Update FileAnalyzer to also support images
FileAnalyzer.SUPPORTED_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}


# =============================================================================
# VOICE (TTS/STT) - placeholders
# =============================================================================

class VoiceProcessor:
    """Text-to-speech and speech-to-text processing."""

    def __init__(self):
        pass

    async def text_to_speech(self, text: str, voice: str = "default") -> bytes:
        """Convert text to speech audio bytes."""
        # Placeholder - would use pyttsx3, edge-tts, or cloud TTS
        return b""

    async def speech_to_text(self, audio_path: str) -> str:
        """Convert speech audio to text."""
        # Placeholder - would use whisper, google speech, etc.
        return "[Speech recognition not configured]"


# =============================================================================
# DEEP RESEARCH AGENT
# =============================================================================

class DeepResearcher:
    """Multi-step research agent that searches, reads, and synthesizes."""

    def __init__(self, searcher: WebSearcher, llm_client=None):
        self.searcher = searcher
        self.llm_client = llm_client

    async def research(self, topic: str, depth: int = 3) -> dict:
        """Conduct deep research on a topic."""
        steps = []
        all_findings = []

        # Step 1: Initial search
        query = topic
        for i in range(depth):
            results = await self.searcher.search(query, max_results=5)
            step_findings = []
            for r in results:
                step_findings.append({
                    "title": r.get("title", ""),
                    "snippet": r.get("snippet", ""),
                    "url": r.get("url", ""),
                })
            all_findings.extend(step_findings)
            steps.append({"query": query, "findings": step_findings})

            # Generate next query based on findings (would use LLM)
            if i < depth - 1 and step_findings:
                query = f"{topic} {step_findings[0]['snippet'][:100]}"

        return {
            "topic": topic,
            "steps": steps,
            "findings": all_findings,
            "summary": f"Researched '{topic}' in {depth} steps. Found {len(all_findings)} sources.",
        }


# =============================================================================
# TRANSLATION
# =============================================================================

class Translator:
    """Translate text between languages."""

    def __init__(self, llm_client=None):
        self.llm_client = llm_client

    async def translate(self, text: str, target_lang: str, source_lang: str = "auto") -> str:
        """Translate text to target language."""
        if self.llm_client:
            prompt = f"Translate the following text to {target_lang}. Source language: {source_lang}.\n\nText: {text}"
            # Would call LLM here
            return f"[Translation to {target_lang}]: {text}"
        return f"[Translation not configured] {text}"

    async def summarize(self, text: str) -> str:
        """Summarize text (placeholder - would use LLM)."""
        if len(text) < 100:
            return text
        # Simple extractive summarization placeholder
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        # Return first 2-3 key sentences
        summary = ". ".join(sentences[:3])
        if len(sentences) > 3:
            summary += "..."
        return summary

    async def write_draft(self, text: str) -> str:
        """Draft/enhance writing (placeholder - would use LLM)."""
        # Basic enhancement: fix capitalization, add structure
        enhanced = text.strip()
        if not enhanced.endswith(('.', '!', '?')):
            enhanced += "."
        return enhanced


# =============================================================================
# MATH/REASONING HELPER
# =============================================================================

class MathHelper:
    """Math and reasoning utilities."""

    @staticmethod
    def evaluate(expression: str) -> dict:
        """Safely evaluate a math expression."""
        # Only allow safe characters
        allowed = set("0123456789+-*/()., ")
        if not all(c in allowed for c in expression):
            return {"success": False, "error": "Invalid characters in expression"}

        try:
            result = eval(expression)  # nosec - input validated
            return {"success": True, "result": result}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    def solve_equation(equation: str) -> dict:
        """Solve simple equations (placeholder for sympy)."""
        return {"success": False, "error": "Equation solver not implemented"}


# =============================================================================
# FEATURE MANAGER - coordinates all features
# =============================================================================

class FeatureManager:
    """Central coordinator for all FreeBot features."""

    def __init__(self, settings=None):
        self.settings = settings
        self.searcher = WebSearcher()
        self.file_analyzer = FileAnalyzer()
        self.code_executor = CodeExecutor()
        # Initialize image generator with API key from settings
        self._init_image_generator()
        self.image_analyzer = ImageAnalyzer()
        self.voice = VoiceProcessor()
        self.researcher = DeepResearcher(self.searcher)
        self.translator = Translator()
        self.math = MathHelper()
        self.current_personality = "freedom"

    def _init_image_generator(self):
        """Initialize ImageGenerator with API key from settings."""
        api_key = ""
        base_url = ""
        if self.settings and self.settings.api_keys:
            # Use first enabled API key that has a key
            for k in self.settings.api_keys:
                if k.enabled and k.key:
                    api_key = k.key
                    base_url = k.base_url.replace("/v1", "") if k.base_url else ""
                    break
        self.image_generator = ImageGenerator(api_key=api_key, base_url=base_url)
        self.available_image_models = [
            "dall-e-3", "stable-diffusion-xl",
        ]

    async def generate_image(self, prompt: str, size: str = "1024x1024", model: str | None = None) -> str | dict:
        """Generate an image using the local freellmapi gateway.

        Picks the model automatically if none is supplied.
        Returns a dict for display (with image data) or error string.
        """
        if not model:
            model = "auto"
        result = await self.image_generator.generate(prompt, size=size, model=model)
        # Include prompt and model in result for display
        result["prompt"] = prompt
        result["model"] = model
        return self._format_image_result_for_display(result)

    def set_personality(self, name: str) -> Personality:
        """Set the active personality."""
        self.current_personality = name
        return get_personality(name)

    def get_personality_prompt(self, name: str = None) -> str:
        """Get the system prompt for a personality (defaults to current)."""
        return get_personality(name or self.current_personality).system_prompt

    def get_recommended_model(self, feature: str) -> str:
        """Get recommended model for a specific feature (deprecated - gateway handles routing)."""
        # Let freellmapi handle model routing based on the task
        return "auto"

    async def close(self):
        """Cleanup resources."""
        await self.searcher.close()

    async def handle_command(self, command: str, args: str) -> str:
        """Handle special commands like /search, /code, /research, etc."""
        cmd = command.lower().lstrip("/")

        if cmd in ("search", "web"):
            results = await self.searcher.search(args, max_results=5)
            return self._format_search_results(results)

        elif cmd in ("research", "deep"):
            result = await self.researcher.research(args)
            return self._format_research_result(result)

        elif cmd in ("code", "exec", "run"):
            # Detect language
            if args.strip().startswith("python") or "def " in args or "import " in args:
                result = await self.code_executor.execute_python(args)
            else:
                result = await self.code_executor.execute_javascript(args)
            return self._format_code_result(result)

        elif cmd in ("translate", "tr"):
            # Format: /translate target_lang | text
            parts = args.split("|", 1)
            if len(parts) == 2:
                lang = parts[0].strip()
                text = parts[1].strip()
                return await self.translator.translate(text, lang)
            return "Usage: /translate <language> | <text>"

        elif cmd in ("math", "calc"):
            return str(self.math.evaluate(args))

        elif cmd in ("personality", "persona"):
            if args in PERSONALITIES:
                p = self.set_personality(args)
                return f"Switched to {p.name} personality: {p.description}"
            return f"Available personalities: {', '.join(PERSONALITIES.keys())}"

        elif cmd in ("image", "img", "generate"):
            # Support optional size: /image prompt --size 1024x1024
            prompt = args
            size = "1024x1024"
            if " --size " in args:
                parts = args.split(" --size ", 1)
                prompt = parts[0].strip()
                size = parts[1].strip()
            return await self.generate_image(prompt, size=size)

        elif cmd in ("analyze", "image_analyze"):
            result = self.image_analyzer.analyze_image(args)
            return self._format_image_analysis(result)

        elif cmd in ("help", "?"):
            return self._get_help()

        return f"Unknown command: /{cmd}. Type /help for available commands."

    def _format_search_results(self, results: list[dict]) -> str:
        if not results:
            return "No results found."
        if "error" in results[0]:
            return f"Search error: {results[0]['error']}"

        lines = ["🔍 **Search Results:**\n"]
        for i, r in enumerate(results, 1):
            lines.append(f"{i}. **{r.get('title', 'No title')}**")
            lines.append(f"   {r.get('snippet', 'No snippet')[:200]}")
            if r.get('url'):
                lines.append(f"   🔗 {r['url']}")
            lines.append("")
        return "\n".join(lines)

    def _format_research_result(self, result: dict) -> str:
        lines = [f"🔬 **Deep Research: {result['topic']}**\n"]
        lines.append(result['summary'])
        lines.append("")
        for i, step in enumerate(result['steps'], 1):
            lines.append(f"**Step {i}:** {step['query']}")
            for f in step['findings'][:2]:
                lines.append(f"  - {f['title']}: {f['snippet'][:150]}")
            lines.append("")
        return "\n".join(lines)

    def _format_code_result(self, result: dict) -> str:
        if result.get("success"):
            return f"✅ **Code executed successfully:**\n```\n{result['output']}\n```"
        else:
            return f"❌ **Code execution failed:**\n```\n{result['error']}\n```"

    def _format_image_result(self, result: dict) -> str:
        if result.get("success") and result.get("image_url"):
            return f"🎨 **Image generated:**\n{result['image_url']}"
        else:
            return f"❌ **Image generation failed:**\n{result.get('error', 'Unknown error')}"

    def _format_image_result_for_display(self, result: dict) -> dict | str:
        """Return a displayable result for image generation - returns dict with image data for UI rendering."""
        if result.get("success") and result.get("image_url"):
            return {
                "type": "image",
                "image_url": result["image_url"],
                "prompt": result.get("prompt", ""),
                "model": result.get("model", "auto"),
            }
        else:
            return f"❌ **Image generation failed:**\n{result.get('error', 'Unknown error')}"

    def _format_image_analysis(self, result: dict) -> str:
        if "error" in result:
            return f"❌ **Image analysis failed:**\n{result['error']}"
        return f"🖼️ **Image Analysis:**\n- **Name:** {result.get('name', 'Unknown')}\n- **Size:** {result.get('size', 0)} bytes\n- **Format:** {result.get('format', 'Unknown')}\n- **Dimensions:** {result.get('width', '?')}x{result.get('height', '?')}"

    def _get_help(self) -> str:
        return """**FreeBot Commands:**
/search <query> - Web search
/research <topic> - Deep multi-step research
/code <code> - Execute Python/JS code
/translate <lang>|<text> - Translate text
/math <expression> - Math evaluation
/personality <name> - Switch personality
/summarize <text> - Summarize text
/write <text> - Draft content
/image <prompt> [--size SIZE] - Generate image (sizes: 1024x1024, 1792x1024, 1024x1792)
/voice <text> - Text-to-speech
/help - Show this help

**File Operations:**
Use natural language:
"create file named test.txt"
"read file test.txt"
"list files in Documents"
"create folder myproject"

**Personalities:** default, freedom, coder, creative, analyst, teacher, skeptic"""


# =============================================================================
# QUICK TEST
# =============================================================================

if __name__ == "__main__":
    async def test():
        fm = FeatureManager()
        print(await fm.handle_command("/search", "Python async programming"))
        print(await fm.handle_command("/math", "2 + 2 * 3"))
        print(await fm.handle_command("/personality", "coder"))
        await fm.close()

    asyncio.run(test())