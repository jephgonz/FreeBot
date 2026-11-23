"""
local_fs.py — Local filesystem wrapper for FreeBot.

Provides a clean, safe interface for file operations that the bot can use.
On Windows, absolute paths (C:\, D:\, etc.) are allowed for full drive access.
On other systems, paths are resolved relative to the user's home directory.
"""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Optional


class LocalFileSystem:
    """Safe wrapper for local filesystem operations."""

    def __init__(self, base_dir: Optional[str] = None):
        """
        Initialize the filesystem wrapper.

        Args:
            base_dir: Base directory for operations. Defaults to user's home directory.
        """
        if base_dir is None:
            self.base_dir = Path.home()
        else:
            self.base_dir = Path(base_dir).expanduser().resolve()

    def _resolve(self, path: str) -> Path:
        """Resolve a path relative to base_dir, with safety checks."""
        p = Path(path).expanduser()

        # On Windows, allow absolute paths (C:\, D:\, etc.) without base_dir restriction
        # This lets users access files on any drive
        if os.name == 'nt' and p.is_absolute():
            # Normalize the path but don't restrict to base_dir
            return p.resolve()

        # For relative paths or non-Windows, use base_dir restriction
        if not p.is_absolute():
            p = self.base_dir / p
        # Ensure the path is within base_dir (prevent directory traversal)
        try:
            p.resolve().relative_to(self.base_dir.resolve())
        except ValueError:
            raise PermissionError(f"Path {path} is outside allowed directory")
        return p

    def read_file(self, path: str) -> str:
        """Read a file and return its content."""
        p = self._resolve(path)
        if not p.exists():
            raise FileNotFoundError(f"File not found: {path}")
        if not p.is_file():
            raise IsADirectoryError(f"Path is a directory, not a file: {path}")
        return p.read_text(encoding="utf-8")

    def write_file(self, path: str, content: str) -> str:
        """Write content to a file, creating parent directories if needed."""
        p = self._resolve(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return f"Created file: {path}"

    def append_file(self, path: str, content: str) -> str:
        """Append content to a file."""
        p = self._resolve(path)
        p.parent.mkdir(parents=True, exist_ok=True)
        with p.open("a", encoding="utf-8") as f:
            f.write(content)
        return f"Appended to file: {path}"

    def delete_file(self, path: str) -> str:
        """Delete a file."""
        p = self._resolve(path)
        if not p.exists():
            raise FileNotFoundError(f"File not found: {path}")
        if not p.is_file():
            raise IsADirectoryError(f"Path is a directory, not a file: {path}")
        p.unlink()
        return f"Deleted file: {path}"

    def list_files(self, path: str = ".") -> dict:
        """List files and directories in a path."""
        p = self._resolve(path)
        if not p.exists():
            raise FileNotFoundError(f"Directory not found: {path}")
        if not p.is_dir():
            raise NotADirectoryError(f"Path is not a directory: {path}")

        files = []
        dirs = []
        for item in p.iterdir():
            if item.is_file():
                files.append({"name": item.name, "size": item.stat().st_size})
            elif item.is_dir():
                dirs.append({"name": item.name})

        return {"path": str(p), "files": files, "dirs": dirs}

    def create_folder(self, path: str) -> str:
        """Create a directory (including parents)."""
        p = self._resolve(path)
        p.mkdir(parents=True, exist_ok=True)
        return f"Created folder: {path}"

    def delete_folder(self, path: str, recursive: bool = False) -> str:
        """Delete a directory."""
        p = self._resolve(path)
        if not p.exists():
            raise FileNotFoundError(f"Directory not found: {path}")
        if not p.is_dir():
            raise NotADirectoryError(f"Path is not a directory: {path}")
        if recursive:
            shutil.rmtree(p)
        else:
            p.rmdir()  # Only works if empty
        return f"Deleted folder: {path}"

    def copy_file(self, src: str, dst: str) -> str:
        """Copy a file."""
        src_p = self._resolve(src)
        dst_p = self._resolve(dst)
        if not src_p.exists():
            raise FileNotFoundError(f"Source file not found: {src}")
        if not src_p.is_file():
            raise IsADirectoryError(f"Source is a directory: {src}")
        dst_p.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_p, dst_p)
        return f"Copied {src} to {dst}"

    def move_file(self, src: str, dst: str) -> str:
        """Move/rename a file."""
        src_p = self._resolve(src)
        dst_p = self._resolve(dst)
        if not src_p.exists():
            raise FileNotFoundError(f"Source not found: {src}")
        dst_p.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src_p), str(dst_p))
        return f"Moved {src} to {dst}"

    def file_exists(self, path: str) -> bool:
        """Check if a file exists."""
        p = self._resolve(path)
        return p.exists() and p.is_file()

    def folder_exists(self, path: str) -> bool:
        """Check if a directory exists."""
        p = self._resolve(path)
        return p.exists() and p.is_dir()

    def get_file_info(self, path: str) -> dict:
        """Get file metadata."""
        p = self._resolve(path)
        if not p.exists():
            raise FileNotFoundError(f"Path not found: {path}")
        stat = p.stat()
        return {
            "name": p.name,
            "path": str(p),
            "size": stat.st_size,
            "modified": stat.st_mtime,
            "is_file": p.is_file(),
            "is_dir": p.is_dir(),
        }


# Convenience function for quick operations
def quick_fs(base_dir: Optional[str] = None) -> LocalFileSystem:
    """Create a LocalFileSystem instance with default settings."""
    return LocalFileSystem(base_dir)


if __name__ == "__main__":
    # Quick test
    fs = LocalFileSystem()
    print("Base dir:", fs.base_dir)
    result = fs.list_files(".")
    print(f"Files: {len(result['files'])}, Dirs: {len(result['dirs'])}")