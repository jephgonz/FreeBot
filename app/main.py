"""
main.py — FreeBot-style desktop chat app on top of a freeLLMapi gateway.
"""

from __future__ import annotations

import asyncio
from typing import Optional

import flet as ft

from . import gateway, history, images, store
from .history import MAX_MESSAGES_PER_BOT
from .local_fs import LocalFileSystem
from .features import FeatureManager, PERSONALITIES
import re
import json
import os
import sys
import subprocess
import base64
import tempfile
from io import BytesIO
from pathlib import Path

from PIL import Image as PILImage



# Color palette - macOS-inspired with light/dark toggle
BG = "#101013"        # Default dark mode
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

# macOS light mode palette (activated when user toggles)
MAC_LIGHT_BG = "#fafafa"
MAC_LIGHT_SIDEBAR = "#ffffff"
MAC_LIGHT_PANEL = "#f5f5f7"
MAC_LIGHT_BUBBLE_USER = "#e5e5e7"
MAC_LIGHT_BUBBLE_BOT = "#ffffff"
MAC_LIGHT_TEXT = "#1c1c1e"
MAC_LIGHT_MUTED = "#86868b"
MAC_LIGHT_BORDER = "#cfcfd2"

# File operation detection patterns
FILE_OP_PATTERNS = [
    r'\b(create|write|make|generate)\b.*\b(file|txt|document)\b',
    r'\b(read|open|view|show|display|cat)\b.*\b(file|txt|document)\b',
    r'\b(delete|remove|erase)\b.*\b(file|txt|document)\b',
    r'\b(move|copy|rename)\b.*\b(file|txt|document|folder|directory)\b',
    r'\b(list|ls|dir|show)\b.*\b(files?|folder|directory)\b',
    r'\b(save|write)\b.*\b(to|in)\b.*\b(file|desktop|folder)\b',
    r'\bcreate\b.*\b(folder|directory)\b',
]


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

        # Feature manager for advanced features
        self.feature_manager = FeatureManager(settings=self.settings)
        self.selected_personality = self.feature_manager.current_personality

        # UI references
        self.bot_list: Optional[ft.Column] = None
        self.chat_list: Optional[ft.ListView] = None
        self.chat_header_name: Optional[ft.Text] = None
        self.chat_header_model: Optional[ft.Text] = None
        self.composer: Optional[ft.TextField] = None
        self.status_text: Optional[ft.Text] = None
        self.sidebar_container: Optional[ft.Container] = None
        self.chat_container: Optional[ft.Container] = None
        self.send_button: Optional[ft.IconButton] = None
        self.selected_personality = "freedom"

        # Settings dialog
        self.base_url_field: Optional[ft.TextField] = None
        self.api_key_field: Optional[ft.TextField] = None
        self.settings_dlg: Optional[ft.AlertDialog] = None

        # Bot dialog
        self.bot_name_field: Optional[ft.TextField] = None
        self.bot_key_dd: Optional[ft.Dropdown] = None
        self.bot_dlg: Optional[ft.AlertDialog] = None

    def build(self) -> None:
        self.page.title = "FreeBot"
        self.page.theme_mode = ft.ThemeMode.DARK
        self.page.bgcolor = BG
        self.page.padding = 0
        self.page.window.width = 1180
        self.page.window.height = 780
        self.page.window.min_width = 760
        self.page.window.min_height = 560

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
        # Personality mode selector
        self.personality_dd = ft.Dropdown(
            label="Personality",
            options=[ft.dropdown.Option(name, p.name.title()) for name, p in PERSONALITIES.items()],
            value=self.feature_manager.current_personality,
            on_select=self._on_personality_change,
            width=230,
            text_size=12,
        )
        # Theme toggle
        self.theme_toggle = ft.PopupMenuButton(
            icon=ft.Icons.LIGHT_MODE,
            items=[
                ft.PopupMenuItem(content=ft.Text("Dark Mode"), on_click=self._on_dark_mode_click, checked=not self.page.theme_mode == ft.ThemeMode.LIGHT),
                ft.PopupMenuItem(content=ft.Text("Light Mode"), on_click=self._on_light_mode_click, checked=self.page.theme_mode == ft.ThemeMode.LIGHT),
                ft.PopupMenuItem(content=ft.Divider()),
                ft.PopupMenuItem(content=ft.Text("System Default"), on_click=self._on_system_mode_click),
            ]
        )

        def _theme_aware_sidebar_bg():
            return MAC_LIGHT_SIDEBAR if self.page.theme_mode == ft.ThemeMode.LIGHT else SIDEBAR_BG
        def _theme_aware_border():
            return MAC_LIGHT_BORDER if self.page.theme_mode == ft.ThemeMode.LIGHT else BORDER
        def _theme_aware_text():
            return MAC_LIGHT_TEXT if self.page.theme_mode == ft.ThemeMode.LIGHT else TEXT
        def _theme_aware_muted():
            return MAC_LIGHT_MUTED if self.page.theme_mode == ft.ThemeMode.LIGHT else MUTED

        sidebar_container = ft.Container(
            width=260,
            bgcolor=_theme_aware_sidebar_bg(),
            border=ft.Border(right=ft.BorderSide(1, _theme_aware_border())),
            padding=ft.Padding(left=14, right=14, top=18, bottom=14),
            content=ft.Column(
                [
                    ft.Row(
                        [
                            ft.Container(
                                content=ft.Icon(ft.Icons.ROCKET_LAUNCH, color="#ffffff", size=18),
                                width=34,
                                height=34,
                                border_radius=10,
                                bgcolor=ACCENT,
                                alignment=ft.Alignment.CENTER,
                            ),
                            ft.Text("FreeBot", size=18, weight=ft.FontWeight.W_700, color=_theme_aware_text()),
                        ],
                        spacing=10,
                        vertical_alignment=ft.CrossAxisAlignment.CENTER,
                    ),
                    ft.Divider(color=_theme_aware_border()),
                    ft.Container(
                        content=ft.Text("CHATS", size=10, weight=ft.FontWeight.W_600, color=_theme_aware_muted()),
                        padding=ft.Padding(left=8, right=8, top=8, bottom=4),
                    ),
                    self.bot_list,
                    ft.Row(
                        [
                            ft.IconButton(
                                icon=ft.Icons.ADD,
                                tooltip="New chat",
                                on_click=self._on_new_bot_click,
                                icon_color=_theme_aware_text(),
                            ),
                            ft.IconButton(
                                icon=ft.Icons.SETTINGS_OUTLINED,
                                tooltip="Settings",
                                on_click=self._on_settings_click,
                                icon_color=_theme_aware_text(),
                            ),
                        ],
                        spacing=4,
                    ),
                    ft.Divider(color=_theme_aware_border()),
                    ft.Column(
                        [
                            ft.Text("PERSONALITY", size=10, weight=ft.FontWeight.W_600, color=_theme_aware_muted()),
                            self.personality_dd,
                        ],
                        spacing=6,
                    ),
                    ft.Row(
                        [
                            ft.Text("Appearance", size=12, color=_theme_aware_muted()),
                            self.theme_toggle,
                        ],
                        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                    ),
                ],
                expand=True,
                spacing=8,
            ),
        )
        self.sidebar_container = sidebar_container
        return sidebar_container

    def _chat_column(self) -> ft.Container:
        def _theme_aware_text():
            return MAC_LIGHT_TEXT if self.page.theme_mode == ft.ThemeMode.LIGHT else TEXT
        def _theme_aware_muted():
            return MAC_LIGHT_MUTED if self.page.theme_mode == ft.ThemeMode.LIGHT else MUTED
        def _theme_aware_border():
            return MAC_LIGHT_BORDER if self.page.theme_mode == ft.ThemeMode.LIGHT else BORDER
        def _theme_aware_bg():
            return MAC_LIGHT_PANEL if self.page.theme_mode == ft.ThemeMode.LIGHT else PANEL_BG

        self.chat_header_name = ft.Text("", size=16, weight=ft.FontWeight.W_700, color=_theme_aware_text(), overflow=ft.TextOverflow.ELLIPSIS)
        self.chat_header_model = ft.Text("", size=11, color=_theme_aware_muted(), overflow=ft.TextOverflow.ELLIPSIS)
        self.status_text = ft.Text("", size=12, color=_theme_aware_muted())
        self.chat_list = ft.ListView(
            expand=True,
            auto_scroll=True,
            spacing=12,
            padding=ft.Padding(left=32, right=32, top=24, bottom=24),
        )
        self.composer = ft.TextField(
            hint_text="Ask FreeBot anything...",
            expand=True,
            min_lines=1,
            max_lines=6,
            multiline=True,
            shift_enter=True,
            on_submit=self._on_send,
            bgcolor=_theme_aware_bg(),
            border_color=_theme_aware_border(),
            color=_theme_aware_text(),
            border_radius=12,
            content_padding=ft.Padding(left=16, right=16, top=12, bottom=12),
        )
        self.send_button = ft.IconButton(
            icon=ft.Icons.ARROW_UPWARD_ROUNDED,
            tooltip="Send",
            icon_color="#ffffff",
            bgcolor=ACCENT,
            width=38,
            height=38,
            on_click=self._on_send,
        )

        chat_container = ft.Container(
            expand=True,
            bgcolor=_theme_aware_bg(),
            content=ft.Column(
                [
                    ft.Container(
                        content=ft.Column([self.chat_header_name, self.chat_header_model], spacing=2),
                        border=ft.Border(bottom=ft.BorderSide(1, _theme_aware_border())),
                        padding=ft.Padding(left=28, right=28, top=14, bottom=14),
                        height=72,
                    ),
                    self.chat_list,
                    ft.Container(
                        content=ft.Column(
                            [
                                ft.Row(
                                    [
                                        ft.Container(
                                            content=ft.Row(
                                                [self.composer, self.send_button],
                                                spacing=8,
                                                vertical_alignment=ft.CrossAxisAlignment.END,
                                            ),
                                            expand=True,
                                            bgcolor=_theme_aware_bg(),
                                            border=ft.Border.all(1, _theme_aware_border()),
                                            border_radius=14,
                                            padding=ft.Padding(left=4, right=6, top=4, bottom=4),
                                        ),
                                    ],
                                    spacing=10,
                                    vertical_alignment=ft.CrossAxisAlignment.END,
                                ),
                                self.status_text,
                            ],
                            spacing=6,
                        ),
                        padding=ft.Padding(left=20, right=20, top=10, bottom=12),
                    ),
                ],
                spacing=0,
                expand=True,
            ),
        )
        self.chat_container = chat_container
        return chat_container

    def _refresh_bot_list(self) -> None:
        if self.bot_list is None: return
        self.bot_list.controls.clear()
        for bot in self.settings.bots:
            is_light = self.page.theme_mode == ft.ThemeMode.LIGHT
            text_color = MAC_LIGHT_TEXT if is_light else TEXT
            muted_color = MAC_LIGHT_MUTED if is_light else MUTED
            selected = bot.name == self.current_bot
            menu = ft.PopupMenuButton(
                icon=ft.Icons.MORE_VERT,
                icon_color=muted_color,
                tooltip="Bot options",
                items=[
                    ft.PopupMenuItem(
                        content=ft.Text("Edit"),
                        icon=ft.Icons.EDIT_OUTLINED,
                        on_click=lambda _, n=bot.name: self._on_edit_bot_click(n),
                    ),
                    ft.PopupMenuItem(
                        content=ft.Text("Delete"),
                        icon=ft.Icons.DELETE_OUTLINE,
                        on_click=lambda _, n=bot.name: self._on_delete_bot_click(n),
                    ),
                ],
            )
            tile = ft.Container(
                content=ft.Row(
                    [
                        ft.Container(
                            width=8,
                            height=8,
                            border_radius=4,
                            bgcolor=bot.color,
                        ),
                        ft.Column(
                            [
                                ft.Text(bot.name, size=13, weight=ft.FontWeight.W_600 if selected else ft.FontWeight.W_400, color=text_color, overflow=ft.TextOverflow.ELLIPSIS),
                                ft.Text(bot.model or "No model selected", size=10, color=muted_color, max_lines=1, overflow=ft.TextOverflow.ELLIPSIS),
                            ],
                            spacing=2,
                            expand=True,
                        ),
                        menu,
                    ],
                    spacing=10,
                    vertical_alignment=ft.CrossAxisAlignment.CENTER,
                ),
                bgcolor="#e8a33d18" if selected else None,
                border=ft.Border(left=ft.BorderSide(3, ACCENT)) if selected else None,
                border_radius=8,
                padding=ft.Padding(left=8, right=8, top=8, bottom=8),
                on_click=lambda _, n=bot.name: self._select_bot(n),
            )
            self.bot_list.controls.append(tile)
        self.bot_list.update()

    def _select_bot(self, name: str) -> None:
        self.current_bot = name
        self.settings.last_bot = name
        store.save_settings(self.settings)
        bot = self._find_bot(name)
        if bot:
            self.chat_header_name.value = bot.name
            self.chat_header_model.value = f"Model: {bot.model}" if bot.model else "Model: auto"
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
            # Store models for reference but don't show dropdown
            self._available_models = [m["id"] for m in models]
            # Use bot's configured model (gateway handles routing)
            if not bot.model and models:
                bot.model = models[0]["id"]
                store.save_settings(self.settings)
        except gateway.GatewayError as e:
            # Log gateway-specific error to status
            if self.status_text:
                self.status_text.value = f"Model load error: {str(e)[:80]}"
                self.status_text.color = ERROR_RED
                self.status_text.update()
        except Exception as e:
            # Log other errors
            if self.status_text:
                self.status_text.value = f"Model load failed: {str(e)[:80]}"
                self.status_text.color = ERROR_RED
                self.status_text.update()

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

        # Check for file operations first
        detected_op = detect_file_operation(text)
        if detected_op:
            self.page.run_task(self._handle_file_operation, detected_op)
        elif text.startswith("/"):
            # Handle feature commands (e.g. /image prompt --size 1024x1024)
            self.page.run_task(self._process_feature_command, text)
        else:
            # Route natural-language image requests to the local image generator
            img_prompt = detect_image_intent(text)
            if img_prompt:
                self.page.run_task(self._generate_image_reply, img_prompt)
            else:
                # Stream reply with bot's configured model (gateway handles routing)
                bot = self._find_bot(self.current_bot)
                if bot:
                    self.page.run_task(self._stream_reply, bot, text)

    
    async def _process_feature_command(self, command: str) -> None:
        # Split "/image draw me a cat" → cmd="image", args="draw me a cat"
        parts = command.lstrip("/").split(None, 1)
        cmd = parts[0] if parts else ""
        args = parts[1] if len(parts) > 1 else ""
        result = await self.feature_manager.handle_command(cmd, args)
        self.page.run_task(self._append_feature_result, result)

    async def _append_feature_result(self, result: str | dict) -> None:
        """Append a feature command result to the chat. Handles text and image results."""
        if not result:
            return
        if isinstance(result, dict) and result.get("type") == "image":
            await self._render_image_result(result)
            return
        text = str(result)
        self._render_message("assistant", text)
        if self.current_bot:
            self.history.setdefault(self.current_bot, []).append(
                {"role": "assistant", "content": f"[Command result] {images.strip_blobs(text)}"}
            )
            history.save_history(self.history)

    async def _render_image_result(self, image_result: dict) -> None:
        """Save the generated image to disk, show it in chat, store a short marker in history."""
        if self.chat_list is None:
            return
        prompt = image_result.get("prompt", "")
        model = image_result.get("model", "auto")
        ref = images.to_ref(image_result.get("image_url", "") or "")
        if not ref:
            self._render_message("assistant", "❌ The gateway returned image data I couldn't decode.")
            return
        content = f"{images.marker(ref)}\n🎨 Image generated ({model})\n{prompt}"
        self._render_message("assistant", content)
        if self.current_bot:
            self.history.setdefault(self.current_bot, []).append({"role": "assistant", "content": content})
            history.save_history(self.history)

    async def _generate_image_reply(self, prompt: str) -> None:
        """Natural-language image request: show a placeholder, generate, then render."""
        is_light = self.page.theme_mode == ft.ThemeMode.LIGHT
        muted = MAC_LIGHT_MUTED if is_light else MUTED
        placeholder = ft.Row(
            [ft.Text("🎨 Generating image…", color=muted, italic=True)],
            alignment=ft.MainAxisAlignment.START,
        )
        self.chat_list.controls.append(placeholder)
        self.chat_list.update()
        try:
            result = await self.feature_manager.generate_image(prompt)
        finally:
            if placeholder in self.chat_list.controls:
                self.chat_list.controls.remove(placeholder)
                self.chat_list.update()
        await self._append_feature_result(result)

    async def _handle_file_operation(self, detected_op: dict) -> None:
        """Handle detected file operation and display result."""
        # Create a temporary bot-like response bubble (theme aware)
        is_light = self.page.theme_mode == ft.ThemeMode.LIGHT
        text_color = MAC_LIGHT_MUTED if is_light else MUTED
        bot_bubble_bg = MAC_LIGHT_BUBBLE_BOT if is_light else BUBBLE_BOT

        # Use direct Text reference pattern (same as _stream_reply)
        bubble_text = ft.Text("🔧 Executing file operation...", color=text_color, selectable=True)
        bubble = ft.Container(
            content=bubble_text,
            bgcolor=bot_bubble_bg,
            border=ft.Border(left=ft.BorderSide(3, ACCENT)),
            border_radius=ft.BorderRadius(top_left=12, top_right=12, bottom_left=0, bottom_right=12),
            padding=ft.Padding(left=14, right=14, top=10, bottom=10),
        )
        self.chat_list.controls.append(ft.Row([bubble], alignment=ft.MainAxisAlignment.START))
        self.chat_list.update()

        result = await execute_file_operation(self, detected_op)
        bubble_text.value = result
        bubble_text.update()

        # Save to history
        if self.current_bot:
            self.history.setdefault(self.current_bot, []).append({"role": "assistant", "content": result})
            history.save_history(self.history)

    async def _stream_reply(self, bot: store.Bot, user_text: str) -> None:
        key = store.get_key(self.settings, bot.api_key_label)
        if not key:
            if self.status_text:
                self.status_text.value = "Configure an API key in Settings"
                self.status_text.color = ERROR_RED
                self.status_text.update()
            return

        # Build messages with personality system prompt + history
        messages = []
        # Use personality-based system prompt
        personality_prompt = self.feature_manager.get_personality_prompt()
        if personality_prompt:
            messages.append({"role": "system", "content": personality_prompt})
        # Add recent history (includes the user message just added)
        bot_history = self.history.get(bot.name, [])
        # Limit to max messages for context window
        messages.extend(
            {"role": m.get("role", "user"), "content": images.for_llm(m.get("content", ""))}
            for m in bot_history[-MAX_MESSAGES_PER_BOT:]
        )

        # Create streaming bubble (theme aware)
        is_light = self.page.theme_mode == ft.ThemeMode.LIGHT
        text_color = MAC_LIGHT_TEXT if is_light else TEXT
        bot_bubble_bg = MAC_LIGHT_BUBBLE_BOT if is_light else BUBBLE_BOT

        bubble_text = ft.Text("", color=text_color, selectable=True, no_wrap=False, max_lines=None, expand=True)
        bubble = ft.Container(
            content=bubble_text,
            bgcolor=bot_bubble_bg,
            border=ft.Border(left=ft.BorderSide(3, bot.color)),
            border_radius=ft.BorderRadius(top_left=12, top_right=12, bottom_left=0, bottom_right=12),
            padding=ft.Padding(left=14, right=14, top=10, bottom=10),
            width=600,
        )
        self.chat_list.controls.append(ft.Row([bubble], alignment=ft.MainAxisAlignment.START))
        self.chat_list.update()

        acc = []
        try:
            async for delta in gateway.chat_stream(key.base_url, key.key, bot.model, messages, bot.temperature):
                acc.append(delta)
                bubble_text.value = images.strip_blobs("".join(acc))
                bubble.update()
        except gateway.GatewayError as e:
            # Show error in the bubble
            error_msg = f"❌ Gateway Error: {str(e)}"
            bubble_text.value = error_msg
            bubble_text.color = ERROR_RED
            bubble.update()
            # Also update status
            if self.status_text:
                self.status_text.value = f"Error: {str(e)[:100]}"
                self.status_text.color = ERROR_RED
                self.status_text.update()
            return

        # Save complete bot response to history
        full_response = "".join(acc)
        # If the model answered with an image (data URI / markdown image), show it as an image
        ref, matched = images.find_image(full_response)
        if ref:
            caption = full_response.replace(matched, "").strip()
            parts: list[ft.Control] = [self._image_widget(ref, text_color)]
            if caption:
                parts.append(ft.Text(caption, color=text_color, selectable=True, no_wrap=False, max_lines=None))
            bubble.content = ft.Column(parts, spacing=8)
            bubble.update()
            full_response = f"{images.marker(ref)} {caption}".strip()
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
        """Render a chat bubble for the given role - theme aware."""
        if self.chat_list is None:
            return
        bot = self._find_bot(self.current_bot) if self.current_bot else None
        bot_color = bot.color if bot else ACCENT

        # Determine colors based on current theme
        is_light = self.page.theme_mode == ft.ThemeMode.LIGHT
        text_color = MAC_LIGHT_TEXT if is_light else TEXT
        # Check if page exists (theme detection)
        if not hasattr(self, 'page'):
            is_light = False  # Fallback
            text_color = TEXT
        user_bubble_bg = MAC_LIGHT_BUBBLE_USER if is_light else BUBBLE_USER
        bot_bubble_bg = MAC_LIGHT_BUBBLE_BOT if is_light else BUBBLE_BOT

        # If this message embeds an image (data URI or image URL), render it visually
        if not isinstance(content, str):
            content = str(content)
        ref, matched = images.find_image(content)
        if ref:
            self._render_image_message(content, ref, matched, role, user_bubble_bg, bot_bubble_bg, bot_color, text_color)
            return
        # Never dump raw base64 / broken image blobs into a text bubble
        content = images.strip_blobs(content)

        # Text with wrapping - use no_wrap=False and set max_lines to None for unlimited wrapping
        text_widget = ft.Text(
            content,
            color=text_color,
            selectable=True,
            no_wrap=False,
            max_lines=None,
        )

        if role == "user":
            bubble = ft.Container(
                content=text_widget,
                bgcolor=user_bubble_bg,
                border_radius=ft.BorderRadius(top_left=12, top_right=12, bottom_left=12, bottom_right=0),
                padding=ft.Padding(left=14, right=14, top=10, bottom=10),
                width=600,  # Max width for wrapping
            )
            row = ft.Row([bubble], alignment=ft.MainAxisAlignment.END)
        else:
            bubble = ft.Container(
                content=text_widget,
                bgcolor=bot_bubble_bg,
                border=ft.Border(left=ft.BorderSide(3, bot_color)),
                border_radius=ft.BorderRadius(top_left=12, top_right=12, bottom_left=0, bottom_right=12),
                padding=ft.Padding(left=14, right=14, top=10, bottom=10),
                width=600,  # Max width for wrapping
            )
            row = ft.Row([bubble], alignment=ft.MainAxisAlignment.START)

        self.chat_list.controls.append(row)
        self.chat_list.update()
        # Auto-scroll to bottom (handled by auto_scroll=True in ListView)

    def _image_widget(self, ref: str, text_color: str) -> ft.Control:
        """Clickable thumbnail; click opens the full-size viewer."""
        try:
            img = ft.Image(
                src=images.flet_src(ref),
                width=420,
                height=420,
                fit=ft.BoxFit.CONTAIN,
                border_radius=ft.BorderRadius(8, 8, 8, 8),
                error_content=ft.Text("🖼️ (image unavailable)", color=text_color),
            )
        except Exception:
            return ft.Text("🖼️ (image file missing)", color=text_color)
        return ft.Container(
            content=img,
            on_click=lambda e, r=ref: self._open_image_viewer(r),
            tooltip="Click to enlarge",
        )

    def _render_image_message(
        self,
        content: str,
        ref: str,
        matched: str,
        role: str,
        user_bubble_bg: str,
        bot_bubble_bg: str,
        bot_color: str,
        text_color: str,
    ) -> None:
        """Render a chat bubble containing an image (+ optional caption)."""
        if self.chat_list is None:
            return
        caption = content.replace(matched, "").strip()
        controls: list[ft.Control] = [self._image_widget(ref, text_color)]
        if caption:
            controls.append(
                ft.Text(caption, color=text_color, selectable=True, no_wrap=False, max_lines=None)
            )

        if role == "user":
            bubble = ft.Container(
                content=ft.Column(controls, spacing=8),
                bgcolor=user_bubble_bg,
                border_radius=ft.BorderRadius(top_left=12, top_right=12, bottom_left=12, bottom_right=0),
                padding=ft.Padding(left=14, right=14, top=10, bottom=10),
                width=600,
            )
            row = ft.Row([bubble], alignment=ft.MainAxisAlignment.END)
        else:
            bubble = ft.Container(
                content=ft.Column(controls, spacing=8),
                bgcolor=bot_bubble_bg,
                border=ft.Border(left=ft.BorderSide(3, bot_color)),
                border_radius=ft.BorderRadius(top_left=12, top_right=12, bottom_left=0, bottom_right=12),
                padding=ft.Padding(left=14, right=14, top=10, bottom=10),
                width=600,
            )
            row = ft.Row([bubble], alignment=ft.MainAxisAlignment.START)

        self.chat_list.controls.append(row)
        self.chat_list.update()

    # ---- full-size image viewer -------------------------------------------
    def _open_image_viewer(self, ref: str) -> None:
        try:
            src = images.flet_src(ref)
        except OSError:
            return
        if getattr(self, "image_viewer_dlg", None) is None:
            self.image_viewer_dlg = ft.AlertDialog(modal=False)
            self.page.overlay.append(self.image_viewer_dlg)
        dlg = self.image_viewer_dlg
        dlg.title = ft.Text(os.path.basename(ref) if images.is_local(ref) else "Image", size=14)
        dlg.content = ft.InteractiveViewer(
            content=ft.Image(src=src, fit=ft.BoxFit.CONTAIN),
            min_scale=0.5,
            max_scale=6,
            width=860,
            height=620,
        )
        actions = []
        if images.is_local(ref):
            actions.append(ft.TextButton("Open file", on_click=lambda e, r=ref: self._open_file_externally(r)))
        actions.append(ft.TextButton("Close", on_click=lambda e: self._close_dlg(dlg)))
        dlg.actions = actions
        dlg.open = True
        self.page.update()

    def _open_file_externally(self, path: str) -> None:
        try:
            if os.name == "nt":
                os.startfile(path)  # type: ignore[attr-defined]
            elif sys.platform == "darwin":
                subprocess.Popen(["open", path])
            else:
                subprocess.Popen(["xdg-open", path])
        except Exception:
            pass

    def _on_dark_mode_click(self, e) -> None:
        self.page.theme_mode = ft.ThemeMode.DARK
        self._apply_theme()

    def _on_light_mode_click(self, e) -> None:
        self.page.theme_mode = ft.ThemeMode.LIGHT
        self._apply_theme()

    def _on_system_mode_click(self, e) -> None:
        self.page.theme_mode = ft.ThemeMode.SYSTEM
        self._apply_theme()

    def _apply_theme(self) -> None:
        is_light = self.page.theme_mode == ft.ThemeMode.LIGHT
        sidebar_bg = MAC_LIGHT_SIDEBAR if is_light else SIDEBAR_BG
        panel_bg = MAC_LIGHT_PANEL if is_light else PANEL_BG
        text_color = MAC_LIGHT_TEXT if is_light else TEXT
        muted_color = MAC_LIGHT_MUTED if is_light else MUTED
        border_color = MAC_LIGHT_BORDER if is_light else BORDER

        self.page.bgcolor = MAC_LIGHT_BG if is_light else BG
        if self.sidebar_container:
            self.sidebar_container.bgcolor = sidebar_bg
            self.sidebar_container.border = ft.Border(right=ft.BorderSide(1, border_color))
        if self.chat_container:
            self.chat_container.bgcolor = panel_bg
        if self.chat_header_name:
            self.chat_header_name.color = text_color
        if self.chat_header_model:
            self.chat_header_model.color = muted_color
        if self.status_text:
            self.status_text.color = muted_color
        if self.composer:
            self.composer.bgcolor = panel_bg
            self.composer.border_color = border_color
            self.composer.color = text_color
        if self.theme_toggle:
            self.theme_toggle.icon = ft.Icons.DARK_MODE if is_light else ft.Icons.LIGHT_MODE

        self._refresh_bot_list()
        self._load_chat_history(self.current_bot)
        self.page.update()

    def _on_personality_change(self, e) -> None:
        name = e.control.value
        self.feature_manager.set_personality(name)
        self.personality_dd.value = name
        store.save_settings(self.settings)
        # Update bot system prompt based on personality
        bot = self._find_bot(self.current_bot)
        if bot:
            bot.system_prompt = self.feature_manager.get_personality_prompt()
            store.save_settings(self.settings)
        self.page.update()

    def _on_new_bot_click(self, e) -> None:
        self.bot_name_field.value = ""
        self.bot_key_dd.value = self.settings.api_keys[0].label if self.settings.api_keys else ""
        self.bot_dlg.title.value = "New/Edit Bot"
        self.bot_dlg.content.controls[2].value = "freedom"
        self.bot_dlg.content.controls[3].value = "auto"
        self.bot_dlg.content.controls[4].value = "0.7"
        self.bot_dlg.content.controls[5].value = "You are a helpful assistant."
        self.selected_personality = "freedom"
        self.bot_dlg.open = True
        self.bot_dlg.update()
    def _on_edit_bot_click(self, name: str) -> None:
        bot = self._find_bot(name)
        if bot:
            self.bot_name_field.value = bot.name
            self.bot_key_dd.value = bot.api_key_label
            # Find personality matching bot's color
            personality_name = next((k for k, p in PERSONALITIES.items() if p.color == bot.color), "freedom")
            self.selected_personality = personality_name
            self.bot_dlg.content.controls[2].value = personality_name
            self.bot_dlg.title.value = "Edit Bot"
            self.bot_dlg.content.controls[3].value = bot.model
            self.bot_dlg.content.controls[4].value = str(bot.temperature)
            self.bot_dlg.content.controls[5].value = bot.system_prompt
            self.bot_dlg.open = True
            self.bot_dlg.update()
    def _on_delete_bot_click(self, name: str) -> None:
        store.remove_bot(self.settings, name)
        store.save_settings(self.settings)
        self._refresh_bot_list()
    def _on_save_bot(self, e) -> None:
        if not self.bot_name_field.value:
            return
        bot = store.Bot(
            name=self.bot_name_field.value,
            api_key_label=self.bot_key_dd.value or (self.settings.api_keys[0].label if self.settings.api_keys else ""),
            model=self.bot_dlg.content.controls[3].value,  # Model field
            system_prompt=self.bot_dlg.content.controls[5].value,  # System prompt field
            temperature=float(self.bot_dlg.content.controls[4].value),  # Temperature field
            color=PERSONALITIES.get(self.selected_personality, PERSONALITIES["default"]).color,
        )
        store.upsert_bot(self.settings, bot)
        store.save_settings(self.settings)
        self._refresh_bot_list()
        # Reload models for the bot's key before selecting
        self.page.run_task(self._load_models_for_bot, bot).add_done_callback(
            lambda _: self.page.run_task(self._select_bot_after_models, bot.name)
        )
        self.bot_name_field.value = ""
        self.bot_dlg.open = False
        self.bot_dlg.update()

    async def _select_bot_after_models(self, name: str) -> None:
        """Select bot after models are loaded."""
        self._select_bot(name)

    def _on_settings_click(self, e) -> None: self.settings_dlg.open = True; self.settings_dlg.update()
    def _on_save_settings(self, e) -> None:
        self.settings.base_url = self.base_url_field.value
        self.settings.notifications_enabled = self.notifications_enabled
        self.settings.launch_at_startup = self.launch_at_startup
        self._toggle_launch_at_startup(self.launch_at_startup)
        if self.settings.api_keys:
            self.settings.api_keys[0].key = self.api_key_field.value
            self.settings.api_keys[0].base_url = self.base_url_field.value
        elif self.api_key_field.value:
            # Create first API key if none exists
            self.settings.api_keys.append(store.ApiKey(
                label="local-gateway",
                key=self.api_key_field.value,
                base_url=self.settings.base_url,
                provider="freellmapi",
                note="Default local gateway",
                enabled=True,
            ))
        store.save_settings(self.settings)
        # Reinitialize image generator with new API key
        self.feature_manager._init_image_generator()
        # Refresh bot dialog's key dropdown
        if self.bot_key_dd:
            self.bot_key_dd.options = [ft.dropdown.Option(k.label, k.label) for k in self.settings.api_keys]
            self.bot_key_dd.update()
        self.settings_dlg.open = False
        self.settings_dlg.update()

    def _close_dlg(self, dlg: ft.AlertDialog) -> None: dlg.open = False; dlg.update()

    def _build_dialogs(self) -> None:
        # Initialize notification settings first so they exist when referenced
        self.notifications_enabled = getattr(self.settings, "notifications_enabled", True)
        self.launch_at_startup = getattr(self.settings, "launch_at_startup", False)

        self.base_url_field = ft.TextField(label="Gateway URL", value=self.settings.base_url)
        self.api_key_field = ft.TextField(label="API Key", password=True, can_reveal_password=True, value=self.settings.api_keys[0].key if self.settings.api_keys else "")
        self.settings_dlg = ft.AlertDialog(
            title=ft.Text("Settings"),
            content=ft.Column([
                self.base_url_field,
                self.api_key_field,
                ft.Text("Notifications", size=14, weight=ft.FontWeight.BOLD, color=TEXT),
                ft.Checkbox(
                    label=ft.Text("Enable desktop notifications"),
                    value=self.notifications_enabled,  # Use actual value now
                    on_change=lambda e: setattr(self, 'notifications_enabled', e.control.value)
                ),
                ft.Text("Launch at Startup", size=14, weight=ft.FontWeight.BOLD, color=TEXT),
                ft.Checkbox(
                    label=ft.Text("Launch FreeBot when Windows starts"),
                    value=self.launch_at_startup,  # Use actual value now
                    on_change=lambda e: setattr(self, 'launch_at_startup', e.control.value)
                ),
                ft.Text(size=8, color=MUTED)
            ]),
            actions=[ft.TextButton("Save", on_click=self._on_save_settings), ft.TextButton("Close", on_click=lambda e: self._close_dlg(self.settings_dlg))]
        )

        # Update settings dialog checkbox values (already set correctly above)
        # No need to update after creation since we used the actual values

        self.bot_name_field = ft.TextField(label="Name")
        self.bot_key_dd = ft.Dropdown(label="API Key", options=[ft.dropdown.Option(k.label, k.label) for k in self.settings.api_keys])
        self.bot_dlg = ft.AlertDialog(
            title=ft.Text("New/Edit Bot"),
            content=ft.Column([
                self.bot_name_field,
                self.bot_key_dd,
                ft.Dropdown(
                    label="Personality",
                    options=[ft.dropdown.Option(name, p.name.title()) for name, p in PERSONALITIES.items()],
                    value="freedom",
                    on_select=lambda e: setattr(self, 'selected_personality', e.control.value)
                ),
                ft.TextField(label="Model", value="auto"),
                ft.TextField(label="Temperature", value="0.7", keyboard_type=ft.KeyboardType.NUMBER),
                ft.TextField(label="System Prompt", multiline=True, min_lines=2, max_lines=5, value="You are a helpful assistant.")
            ]),
            actions=[ft.TextButton("Save", on_click=self._on_save_bot), ft.TextButton("Close", on_click=lambda e: self._close_dlg(self.bot_dlg))]
        )

        self.page.overlay.extend([self.settings_dlg, self.bot_dlg])

    def _show_notification(self, title: str, message: str) -> None:
        """Show a desktop notification."""
        if not self.notifications_enabled:
            return
        try:
            if os.name == 'nt':
                # Windows - use PowerShell for toast notification
                ps_script = f'''
                [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
                $template = [Windows.UI.Notifications.ToastTemplateType]::ToastText02
                $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent($template)
                $text = $xml.GetElementsByTagName("text")
                $text[0].AppendChild($xml.CreateTextNode("{title}"))
                $text[1].AppendChild($xml.CreateTextNode("{message}"))
                $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
                [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier("FreeBot").Show($toast)
                '''
                subprocess.Popen(["powershell", "-Command", ps_script],
                                creationflags=subprocess.CREATE_NO_WINDOW)
            else:
                # Linux/Mac - use notify-send
                subprocess.Popen(["notify-send", title, message])
        except Exception:
            pass  # Silently fail if notifications aren't available

    def _toggle_launch_at_startup(self, enable: bool) -> None:
        """Add or remove FreeBot from Windows startup."""
        if os.name != 'nt':
            return
        try:
            import winreg
            key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE) as key:
                if enable:
                    # Get the path to the executable/script
                    exe_path = sys.executable
                    script_path = os.path.abspath("run.py")
                    winreg.SetValueEx(key, "FreeBot", 0, winreg.REG_SZ, f'"{exe_path}" "{script_path}"')
                else:
                    try:
                        winreg.DeleteValue(key, "FreeBot")
                    except FileNotFoundError:
                        pass
            self.launch_at_startup = enable
            self.settings.launch_at_startup = enable
            store.save_settings(self.settings)
        except Exception:
            pass

    def _check_launch_at_startup(self) -> bool:
        """Check if FreeBot is set to launch at startup."""
        if os.name != 'nt':
            return False
        try:
            import winreg
            key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_READ) as key:
                winreg.QueryValueEx(key, "FreeBot")
                return True
        except Exception:
            return False

# File operation tools - use LocalFileSystem wrapper
_fs = LocalFileSystem()  # Module-level instance


async def handle_file_operation(operation: str, path: str, content: str = "") -> str:
    """Execute file operations using LocalFileSystem wrapper."""
    try:
        if operation == "create_file":
            result = _fs.write_file(path, content)
            return f"✅ {result}"

        elif operation == "read_file":
            file_content = _fs.read_file(path)
            return f"📄 Content of {path}:\n```\n{file_content}\n```"

        elif operation == "delete_file":
            result = _fs.delete_file(path)
            return f"🗑️ {result}"

        elif operation == "list_files":
            result = _fs.list_files(path)
            output = f"📁 Contents of {result['path']}:\n"
            if result['dirs']:
                output += "  📂 " + "\n  📂 ".join(d['name'] for d in result['dirs']) + "\n"
            if result['files']:
                output += "  📄 " + "\n  📄 ".join(f['name'] for f in result['files'])
            return output

        elif operation == "create_folder":
            result = _fs.create_folder(path)
            return f"📁 {result}"

        elif operation == "append_file":
            result = _fs.append_file(path, content)
            return f"✅ {result}"

        elif operation == "copy_file":
            # Expect path to be "src|dst"
            src, dst = path.split("|", 1)
            result = _fs.copy_file(src.strip(), dst.strip())
            return f"📋 {result}"

        elif operation == "move_file":
            src, dst = path.split("|", 1)
            result = _fs.move_file(src.strip(), dst.strip())
            return f"📦 {result}"

        else:
            return f"❌ Unknown operation: {operation}"

    except Exception as e:
        return f"❌ Error: {str(e)}"


def detect_file_operation(text: str) -> dict | None:
    """Detect if user message contains a file operation request."""
    text_lower = text.lower()

    # Check for file creation
    if re.search(r'\b(create|write|make|generate)\b.*\b(file|txt)\b', text_lower):
        # Try to extract filename
        match = re.search(r'(?:create|write|make|generate)\b.*?(?:file|txt)\s+(?:named|called)?\s*["\']?([^"\'\s]+(?:\.txt)?)[\'"\s]', text_lower)
        if match:
            filename = match.group(1)
            if not filename.endswith('.txt'):
                filename += '.txt'
            return {"operation": "create_file", "path": filename, "content": ""}

    # Check for read file
    if re.search(r'\b(read|open|view|show|display|cat)\b.*\b(file|txt)\b', text_lower):
        match = re.search(r'(?:read|open|view|show|display|cat)\s+(?:file\s+)?["\']?([^"\'\s]+(?:\.txt)?)[\'"\s]', text_lower)
        if match:
            filename = match.group(1)
            if not filename.endswith('.txt'):
                filename += '.txt'
            return {"operation": "read_file", "path": filename}

    # Check for delete file
    if re.search(r'\b(delete|remove|erase)\b.*\b(file|txt)\b', text_lower):
        match = re.search(r'(?:delete|remove|erase)\s+(?:file\s+)?["\']?([^"\'\s]+(?:\.txt)?)[\'"\s]', text_lower)
        if match:
            filename = match.group(1)
            if not filename.endswith('.txt'):
                filename += '.txt'
            return {"operation": "delete_file", "path": filename}

    # Check for list files
    if re.search(r'\b(list|ls|dir|show)\b.*\b(files?|folder|directory)\b', text_lower):
        match = re.search(r'(?:list|ls|dir|show)\s+(?:files?\s+(?:in|of)\s+)?["\']?([^"\'\s]+)?[\'"\s]', text_lower)
        path = match.group(1) if match and match.group(1) else "~"
        return {"operation": "list_files", "path": path}

    # Check for create folder
    if re.search(r'\bcreate\b.*\b(folder|directory)\b', text_lower):
        match = re.search(r'create\s+(?:folder|directory)\s+["\']?([^"\'\s]+)[\'"\s]', text_lower)
        if match:
            return {"operation": "create_folder", "path": match.group(1)}

    return None


def detect_image_intent(text: str) -> str | None:
    """Detect if user message requests an image generation (natural language)."""
    text_lower = text.lower().strip()
    patterns = [
        r'\b(?:draw|paint|sketch|illustrate)\b',
        r'\b(?:generate|create|make|render|produce|show me)\b.{0,30}\b(?:images?|pictures?|pics?|photos?|art|artwork|illustrations?|logos?|wallpapers?|posters?|portraits?|drawings?)\b',
        r'\b(?:image|picture|pic|photo)\b.{0,10}\bof\b',
    ]
    for pat in patterns:
        if re.search(pat, text_lower):
            return text
    return None


async def execute_file_operation(app, detected_op: dict) -> str:
    """Execute a detected file operation and return result."""
    return await handle_file_operation(
        detected_op["operation"],
        detected_op["path"],
        detected_op.get("content", "")
    )


def main(page: ft.Page) -> None:
    app = FreeBotApp(page)
    app.build()

if __name__ == "__main__":
    ft.run(main)
