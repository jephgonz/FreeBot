"""
run.py — Entry point for the FreeBot desktop app.

    python run.py

Opens a FreeBot-style desktop window. Requires your freeLLMapi gateway to be
running at http://127.0.0.1:8000 (configurable in-app under Settings).
"""

from app.main import main

if __name__ == "__main__":
    import flet as ft

    ft.run(main)
