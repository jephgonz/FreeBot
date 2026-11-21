"""
main.py — FreeBot-style desktop chat app on top of a freeLLMapi gateway.
"""

from __future__ import annotations

import asyncio
from typing import Optional

import flet as ft

from . import gateway, history, store
from .history import MAX_MESSAGES_PER_BOT

# FreeBot-ish dark palette
BG = "#101013"
SIDEBAR_BG = "#16161a"
PANEL_BG = "#1d1d23"
BUBBLE_USER = "#2b2b33"
BUBBLE_BOT = "#1a1a20"
TEXT = "#ececf1"
MUTED = "#8a8a94"
ACCENT = "#e8a33d"
BORDER = "#2a2a32"
ERROR_RED = "#e5534b"
USER_COLOR = "#3b82f6"


class FreeBotApp:
    def __init__(self, page: ft.Page):
        self.page = page
        self.settings = store.load_settings()
        self.history = history.load_history()

        # Validate bot API key references
        self._validate_bot_keys()

        self.current_bot = self.settings.last_bot or (
            self.settings.bots[0].name if self.settings.bots else ""
        )
        self.streaming = False

        # UI references
        self.bot_list: Optional[ft.Column] = None
        self.chat_list: Optional[ft.ListView] = None
        self.chat_header_name: Optional[ft.Text] = None
        self.chat_header_model: Optional[ft.Text] = None
        self.composer: Optional[ft.TextField] = None
        self.model_dd: Optional[ft.Dropdown] = None
        self.status_text: Optional[ft.Text] = None

        # Settings dialog
        self.base_url_field: Optional[ft.TextField] = None
        self.api_key_field: Optional[ft.TextField] = None
        self.settings_dlg: Optional[ft.AlertDialog] = None

        # Bot dialog
        self.bot_name_field: Optional[ft.TextField] = None
        self.bot_key_dd: Optional[ft.Dropdown] = None
        self.bot_model_dd: Optional[ft.Dropdown] = None
        self.bot_dlg: Optional[ft.AlertDialog] = None

    def build(self) -> None:
        self.page.title = "FreeBot — FreeBot-style"
        self.page.theme_mode = ft.ThemeMode.DARK
        self.page.bgcolor = BG
        self.page.padding = 0
        self.page.window.width = 1180
        self.page.window.height = 780

        self.page.add(
            ft.Row(
                [
                    self._sidebar(),
                    self._chat_column(),
                ],
                expand=True,
                spacing=0,
            )
        )
        self._build_dialogs()
        self._refresh_bot_list()
        self._select_bot(self.current_bot)

    def _sidebar(self) -> ft.Container:
        self.bot_list = ft.Column(spacing=4, scroll=ft.ScrollMode.AUTO, expand=True)
        return ft.Container(
            width=250,
            bgcolor=SIDEBAR_BG,
            border=ft.Border(right=ft.BorderSide(1, BORDER)),
            padding=12,
            content=ft.Column(
                [
                    ft.Row([ft.Icon(ft.Icons.ROCKET_LAUNCH, color=ACCENT), ft.Text("FreeBot", weight=ft.FontWeight.BOLD, color=TEXT)], spacing=8),
                    ft.Divider(color=BORDER),
                    self.bot_list,
                    ft.Row([
                        ft.IconButton(icon=ft.Icons.ADD, on_click=self._on_new_bot_click),
                        ft.IconButton(icon=ft.Icons.SETTINGS, on_click=self._on_settings_click),
                    ]),
                ],
                expand=True,
            ),
        )

    def _chat_column(self) -> ft.Container:
        self.chat_header_name = ft.Text("", size=18, weight=ft.FontWeight.BOLD, color=TEXT)
        self.chat_header_model = ft.Text("", size=12, color=MUTED)
        self.status_text = ft.Text("", size=12, color=MUTED)
        self.chat_list = ft.ListView(expand=True, padding=ft.Padding(left=24, right=24, top=20, bottom=12))
        self.composer = ft.TextField(hint_text="Message…", expand=True, on_submit=self._on_send)
        self.model_dd = ft.Dropdown(width=150, hint_text="Model", on_select=self._on_model_change)

        return ft.Container(
            expand=True,
            content=ft.Column(
                [
                    ft.Container(content=ft.Column([self.chat_header_name, self.chat_header_model]), border=ft.Border(bottom=ft.BorderSide(1, BORDER)), padding=10),
                    self.chat_list,
                    ft.Container(content=ft.Row([self.model_dd, self.composer]), padding=10),
                    self.status_text,
                ]
            ),
        )

    def _refresh_bot_list(self) -> None:
        if self.bot_list is None: return
        self.bot_list.controls.clear()
        for bot in self.settings.bots:
            self.bot_list.controls.append(ft.ListTile(title=ft.Text(bot.name, color=TEXT), on_click=lambda _, n=bot.name: self._select_bot(n)))
        self.bot_list.update()

    def _select_bot(self, name: str) -> None:
        self.current_bot = name
        self.settings.last_bot = name
        store.save_settings(self.settings)
        bot = self._find_bot(name)
        if bot:
            self.chat_header_name.value = bot.name
            # Don't set model_dd.value here - wait for options to load in _load_models_for_bot
            self.page.run_task(self._load_models_for_bot, bot)
        # Load chat history for this bot
        self._load_chat_history(name)
        self.chat_list.update()
        self.bot_list.update()

    async def _load_models_for_bot(self, bot: store.Bot) -> None:
        key = store.get_key(self.settings, bot.api_key_label)
        if not key:
            return
        try:
            models = await gateway.list_models(key.base_url, key.key)
            opts = [ft.dropdown.Option(m["id"], m["id"]) for m in models]
            self.model_dd.options = opts
            if opts:
                self.model_dd.value = bot.model if bot.model in [o.key for o in opts] else opts[0].key
            self.model_dd.hint_text = "Select model"
            self.model_dd.update()
        except Exception:
            self.model_dd.hint_text = "Failed to load models"
            self.model_dd.update()

    def _validate_bot_keys(self) -> None:
        """Ensure all bots reference valid, enabled API keys."""
        valid_labels = {k.label for k in self.settings.api_keys if k.enabled}
        for bot in self.settings.bots:
            if bot.api_key_label not in valid_labels:
                # Fall back to first available key or clear
                bot.api_key_label = next((k.label for k in self.settings.api_keys if k.enabled), "")

    def _find_bot(self, name: str) -> Optional[store.Bot]:
        for b in self.settings.bots:
            if b.name == name:
                return b
        return None

    def _load_chat_history(self, bot_name: str) -> None:
        """Load and display chat history for the given bot."""
        if self.chat_list is None:
            return
        self.chat_list.controls.clear()
        msgs = self.history.get(bot_name, [])
        for m in msgs:
            role = m.get("role", "user")
            content = m.get("content", "")
            self._render_message(role, content)
        self.chat_list.update()

    def _on_send(self, e) -> None:
        text = (self.composer.value or "").strip()
        if not text: return
        self.composer.value = ""
        self.composer.update()
        self._append_message("user", text)
        bot = self._find_bot(self.current_bot)
        if bot:
            self.page.run_task(self._stream_reply, bot, text)

    async def _stream_reply(self, bot: store.Bot, user_text: str) -> None:
        key = store.get_key(self.settings, bot.api_key_label)
        if not key:
            return

        # Build messages with system prompt + history + current user message
        messages = []
        if bot.system_prompt:
            messages.append({"role": "system", "content": bot.system_prompt})
        # Add recent history
        bot_history = self.history.get(bot.name, [])
        messages.extend(bot_history[-(MAX_MESSAGES_PER_BOT - 1):])  # Leave room for current message
        # Add current user message
        messages.append({"role": "user", "content": user_text})

        # Create streaming bubble
        bubble = ft.Container(
            content=ft.Text("", color=TEXT, selectable=True),
            bgcolor=BUBBLE_BOT,
            border=ft.Border(left=ft.BorderSide(3, bot.color)),
            border_radius=ft.border_radius.only(top_left=12, top_right=12, bottom_left=0, bottom_right=12),
            padding=ft.Padding(left=14, right=14, top=10, bottom=10),
        )
        self.chat_list.controls.append(ft.Row([bubble], alignment=ft.MainAxisAlignment.START))
        self.chat_list.update()
        self.chat_list.scroll_to(offset=-1, duration=100)

        acc = []
        async for delta in gateway.chat_stream(key.base_url, key.key, bot.model, messages, bot.temperature):
            acc.append(delta)
            bubble.content.value = "".join(acc)
            bubble.update()
            self.chat_list.scroll_to(offset=-1, duration=50)

        # Save complete bot response to history
        full_response = "".join(acc)
        if full_response and self.current_bot:
            self.history.setdefault(self.current_bot, []).append({"role": "assistant", "content": full_response})
            history.save_history(self.history)

    def _append_message(self, role: str, content: str) -> None:
        """Append a message to the chat UI and persist to history."""
        if not content:
            return
        # Render to UI
        self._render_message(role, content)
        # Persist to history
        if self.current_bot:
            self.history.setdefault(self.current_bot, []).append({"role": role, "content": content})
            history.save_history(self.history)

    def _render_message(self, role: str, content: str) -> None:
        """Render a chat bubble for the given role."""
        if self.chat_list is None:
            return
        bot = self._find_bot(self.current_bot) if self.current_bot else None
        bot_color = bot.color if bot else ACCENT

        if role == "user":
            bubble = ft.Container(
                content=ft.Text(content, color=TEXT, selectable=True),
                bgcolor=BUBBLE_USER,
                border_radius=ft.border_radius.only(top_left=12, top_right=12, bottom_left=12, bottom_right=0),
                padding=ft.Padding(left=14, right=14, top=10, bottom=10),
                alignment=ft.alignment.center_right,
            )
            row = ft.Row([bubble], alignment=ft.MainAxisAlignment.END)
        else:
            bubble = ft.Container(
                content=ft.Text(content, color=TEXT, selectable=True),
                bgcolor=BUBBLE_BOT,
                border=ft.Border(left=ft.BorderSide(3, bot_color)),
                border_radius=ft.border_radius.only(top_left=12, top_right=12, bottom_left=0, bottom_right=12),
                padding=ft.Padding(left=14, right=14, top=10, bottom=10),
            )
            row = ft.Row([bubble], alignment=ft.MainAxisAlignment.START)

        self.chat_list.controls.append(row)
        self.chat_list.update()
        # Auto-scroll to bottom
        self.chat_list.scroll_to(offset=-1, duration=100)

    def _on_model_change(self, e) -> None:
        bot = self._find_bot(self.current_bot)
        if bot: bot.model = self.model_dd.value
        store.save_settings(self.settings)

    def _on_new_bot_click(self, e) -> None: self.bot_dlg.open = True; self.bot_dlg.update()
    def _on_save_bot(self, e) -> None:
        if not self.bot_name_field.value:
            return
        bot = store.Bot(
            name=self.bot_name_field.value,
            api_key_label=self.bot_key_dd.value or (self.settings.api_keys[0].label if self.settings.api_keys else ""),
            model=self.bot_model_dd.value or "",
            system_prompt="You are a witty, direct AI assistant modeled after FreeBot. Be concise, clever, and helpful.",
            temperature=0.7,
            color="#e8a33d",
        )
        self.settings.bots.append(bot)
        store.save_settings(self.settings)
        self._refresh_bot_list()
        self._select_bot(bot.name)
        self.bot_name_field.value = ""
        self.bot_dlg.open = False
        self.bot_dlg.update()

    async def _load_models_for_bot_dialog(self) -> None:
        if not self.settings.api_keys:
            return
        key = self.settings.api_keys[0]
        try:
            models = await gateway.list_models(key.base_url, key.key)
            opts = [ft.dropdown.Option(m["id"], m["id"]) for m in models]
            self.bot_model_dd.options = opts
            if opts:
                self.bot_model_dd.value = opts[0].key
            self.bot_model_dd.hint_text = "Select model"
            self.bot_model_dd.update()
        except Exception:
            self.bot_model_dd.hint_text = "Failed to load models"
            self.bot_model_dd.update()
    def _on_settings_click(self, e) -> None: self.settings_dlg.open = True; self.settings_dlg.update()
    def _on_save_settings(self, e) -> None:
        self.settings.base_url = self.base_url_field.value
        if self.settings.api_keys: self.settings.api_keys[0].key = self.api_key_field.value
        store.save_settings(self.settings)
        self.settings_dlg.open = False
        self.settings_dlg.update()

    def _close_dlg(self, dlg: ft.AlertDialog) -> None: dlg.open = False; dlg.update()

    def _build_dialogs(self) -> None:
        self.base_url_field = ft.TextField(label="Gateway URL", value=self.settings.base_url)
        self.api_key_field = ft.TextField(label="API Key", password=True, can_reveal_password=True, value=self.settings.api_keys[0].key if self.settings.api_keys else "")
        self.settings_dlg = ft.AlertDialog(
            title=ft.Text("Settings"),
            content=ft.Column([self.base_url_field, self.api_key_field]),
            actions=[ft.TextButton("Save", on_click=self._on_save_settings), ft.TextButton("Close", on_click=lambda e: self._close_dlg(self.settings_dlg))]
        )

        self.bot_name_field = ft.TextField(label="Name")
        self.bot_key_dd = ft.Dropdown(label="API Key", options=[ft.dropdown.Option(k.label, k.label) for k in self.settings.api_keys])
        self.bot_model_dd = ft.Dropdown(label="Model", hint_text="Loading...")
        self.bot_dlg = ft.AlertDialog(
            title=ft.Text("New Bot"),
            content=ft.Column([self.bot_name_field, self.bot_key_dd, self.bot_model_dd]),
            actions=[ft.TextButton("Save", on_click=self._on_save_bot), ft.TextButton("Close", on_click=lambda e: self._close_dlg(self.bot_dlg))]
        )

        self.page.overlay.extend([self.settings_dlg, self.bot_dlg])
        self.page.run_task(self._load_models_for_bot_dialog)

def main(page: ft.Page) -> None:
    app = FreeBotApp(page)
    app.build()

if __name__ == "__main__":
    ft.run(main)
