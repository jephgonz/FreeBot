# FreeBot — Advanced AI Desktop Assistant

A macOS-styled desktop AI assistant (Flet / Python) with powerful features built on a free LLM gateway. Supports dark/light mode, personality modes, web search, code execution, file operations, deep research, and more.

## ✨ Features

### Core Chat
- **macOS-inspired UI** — Clean sidebar, streaming chat bubbles, dark mode only
- **Multiple Bots** — Each with name, avatar color, system prompt, temperature, model, and API key
- **Multiple API Keys** — Manage tokens across different providers; each bot uses its bound key
- **Live Streaming** — Tokens render in real-time via SSE from the gateway
- **Persistent History** — Chats and settings saved to disk (`config.json`, `history.json`)

### Personality Modes
- **Default** — Balanced, helpful assistant
- **FreeBot** — Witty, direct, clever (FreeBot-style)
- **CodeBot** — Expert programmer, terse and technical
- **CreativeBot** — Imaginative, expressive, artistic
- **AnalystBot** — Deep thinking, thorough, analytical
- **TeacherBot** — Patient, clear, educational
- **SkepticBot** — Critical, questioning, rigorous

### Search & Knowledge
- **Web Search** (`/search query`) — DuckDuckGo HTML scraping (no API key needed)
- **Deep Research** (`/research topic`) — Multi-step research with synthesized report
- **Think Mode** — Slower, deeper reasoning via personality system

### Code & Execution
- **Code Execution** (`/code python code`) — Run Python/JS in sandboxed subprocess (30s timeout)
- **Code Writing/Debugging** — Via CodeBot personality

### File Operations (Natural Language)
- `create file named notes.txt with content hello`
- `read file notes.txt`
- `list files in Documents`
- `create folder myproject`
- `delete file old.txt`
- **Full drive access on Windows** — Use absolute paths like `C:\Users\Name\Desktop\file.txt`

### Document & Text Processing
- **Summarize** (`/summarize text`) — Extractive summarization
- **Translate** (`/translate lang | text`) — Multi-language translation
- **Write/Draft** (`/write prompt`) — Content generation
- **Math** (`/math expression`) — Safe math evaluation

### Multimodal (Planned/Extensible)
- Image generation/editing — Pluggable API (DALL-E, Stable Diffusion)
- Image analysis — OCR and vision API integration
- Voice I/O — TTS/STT placeholder framework
- Video generation — API integration points

### Advanced
- **Desktop Notifications** — Windows toast / Linux notify-send
- **Launch at Startup** — Windows registry integration
- **Memory & Projects** — Per-bot history + workspace concept
- **Connector Framework** — Extensible for calendar, email, drive APIs

## Quick Start

```bash
pip install flet httpx beautifulsoup4
python run.py
```

Then in the app:
1. Open **Settings** (gear icon) → enter gateway base URL (default `http://127.0.0.1:8000/v1`) and API key
2. Click **＋** to create a bot, pick its key + model + personality
3. Chat in the composer. Toggle Dark/Light mode from sidebar
4. Use commands: `/search`, `/research`, `/code`, `/translate`, `/math`, `/personality`, `/help`

## Commands Reference

| Command | Description | Example |
|---------|-------------|---------|
| `/search <query>` | Web search | `/search Python async patterns` |
| `/research <topic>` | Deep multi-step research | `/research quantum computing basics` |
| `/code <code>` | Execute Python/JS | `/code print(2+2)` |
| `/translate <lang> | <text>` | Translate text | `/translate spanish | Hello world` |
| `/math <expr>` | Evaluate math | `/math 2 + 3 * 4` |
| `/summarize <text>` | Summarize text | `/summarize Long article...` |
| `/write <prompt>` | Draft content | `/write email to boss about raise` |
| `/personality <name>` | Switch personality | `/personality coder` |
| `/help` | Show all commands | `/help` |

## File Operations (Natural Language)

Just type naturally:
- "Create file named todo.txt with content Buy milk"
- "Read file todo.txt"
- "List files in Desktop"
- "Create folder Projects"
- "Delete file old.txt"

On Windows, use absolute paths: `C:\Users\Name\Desktop\file.txt`

## Project Layout

```
run.py              # Entry point (flet run)
app/
  main.py           # Flet UI — sidebar, chat, dialogs, theme
  gateway.py        # Gateway client (models + streamed chat)
  store.py          # Settings + API keys + bots (config.json)
  history.py        # Per-bot chat history (history.json)
  local_fs.py       # Local filesystem wrapper (safe operations)
  features.py       # Advanced features: search, code, research, etc.
```

## How It Connects

The app speaks the **OpenAI-compatible** protocol that freeLLMapi exposes:
- `GET  {base}/models` — list models
- `POST {base}/chat/completions` — streamed chat (`stream: true`)

So `base = http://127.0.0.1:8000/v1` with `Bearer <token>` header. Any OpenAI-compatible gateway works.

## Extending

### Add New Personalities
Edit `features.py` → `PERSONALITIES` dict.

### Add New Commands
Extend `FeatureManager.handle_command()` in `features.py`.

### Add Connectors
Create new classes in `features.py` and wire into `FeatureManager`.

## Notes

- **Keys stored in plain text** in `config.json` — local desktop app only; don't commit
- **Token usage** tracked by gateway, not this app
- **File operations** restricted to user home directory (or full drive on Windows)
- **Code execution** runs in temp files with 30s timeout, auto-cleanup

## Roadmap (Planned)

- [ ] Image generation API integration (DALL-E, SD, Midjourney)
- [ ] Voice input/output (Whisper, Edge TTS, cloud APIs)
- [ ] Video generation (Grok Imagine, Runway, etc.)
- [ ] AI companions / animated personas
- [ ] Connectors: Calendar, Email, Drive, Notion
- [ ] Knowledge bases for RAG
- [ ] Team accounts & security controls
- [ ] Structured JSON outputs
- [ ] Plugin/tool system for agents