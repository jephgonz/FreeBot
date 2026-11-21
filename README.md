# FreeBot — FreeBot-style desktop chat on a free LLM gateway

A desktop chat app (Flet / Python) styled after **FreeBot**, that lets you create
**bots** which talk through a **freeLLMapi**-style local gateway. Each bot is
bound to one of your **API keys** (tokens) and one model, and spends that
key's token budget as you chat.

## Features

- **FreeBot-style dark UI** — sidebar of bots, streaming chat bubbles, composer
  with model picker.
- **Multiple bots** — each with its own name, avatar color, system prompt,
  temperature, model, and API key.
- **Multiple API keys** — add as many free-LLM tokens as you like; each bot
  consumes the token budget of the key it's bound to.
- **Live streaming** — tokens render as they arrive (SSE via the gateway).
- **Persistent history** — chats and settings are saved to disk (`config.json`,
  `history.json`) and reload on launch.

## Quick start

```bash
pip install flet httpx
python run.py
```

Then in the app:

1. Open **Settings** (gear icon) → enter your gateway base URL
   (default `http://127.0.0.1:8000/v1`) and add an API key.
2. Click **＋** to create a bot, pick its key + model.
3. Chat in the composer. The bot streams replies using that key's tokens.

## How it connects

The app speaks the **OpenAI-compatible** protocol that freeLLMapi exposes:

- `GET  {base}/models` — list models
- `POST {base}/chat/completions` — streamed chat (`stream: true`)

So `base = http://127.0.0.1:8000/v1` with a `Bearer <token>` header. Any
OpenAI-compatible gateway works the same way.

## Project layout

```
run.py            # entry point (flet run)
app/
  main.py         # Flet UI — sidebar, chat, drawers
  gateway.py      # gateway client (models + streamed chat)
  store.py        # settings + API keys + bots (config.json)
  history.py      # per-bot chat history (history.json)
```

## Notes

- Keys are stored **in plain text** in `config.json` — this is a local
  desktop app; don't commit that file anywhere.
- Token usage is tracked implicitly: the gateway spends tokens from the key
  the bot is bound to. This app doesn't meter usage itself; the freeLLMapi
  gateway does.
