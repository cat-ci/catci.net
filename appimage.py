#!/usr/bin/env python3
"""Simple AppImage installer for Linux.

Usage:
  python appimage.py install path/to/foo.AppImage [path/to/bar.AppImage ...]
  python appimage.py uninstall foo.AppImage
  python appimage.py list
  python appimage.py info foo.AppImage

This script installs AppImage files into ~/.local/share/appimages, makes them executable,
creates ~/.local/bin symlinks, and adds a desktop entry for GNOME/KDE/xfce.
"""

from __future__ import annotations

import argparse
import shutil
import stat
from pathlib import Path
import os
import sys

APPIMAGE_DIR = Path.home() / '.local' / 'share' / 'appimages'
BIN_DIR = Path.home() / '.local' / 'bin'
DESKTOP_DIR = Path.home() / '.local' / 'share' / 'applications'

DEFAULT_CATEGORIES = 'Utility;Application;'


def ensure_dirs() -> None:
    APPIMAGE_DIR.mkdir(parents=True, exist_ok=True)
    BIN_DIR.mkdir(parents=True, exist_ok=True)
    DESKTOP_DIR.mkdir(parents=True, exist_ok=True)


def make_executable(path: Path) -> None:
    st = path.stat()
    path.chmod(st.st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def sanitize_name(name: str) -> str:
    return name.replace(' ', '-').replace('.AppImage', '').replace('.appimage', '').strip()


def desktop_file_for(app_path: Path, display_name: str) -> str:
    exec_path = str(app_path)
    icon = str(app_path)  # AppImage can provide an icon from runtime
    return f"""[Desktop Entry]
Type=Application
Name={display_name}
Exec={exec_path} %U
Icon={icon}
Categories={DEFAULT_CATEGORIES}
Terminal=false
StartupNotify=true
X-AppImage-Version=1
"""


def install_appimages(files: list[Path], force: bool = False, no_desktop: bool = False) -> None:
    ensure_dirs()

    for file_path in files:
        if not file_path.exists():
            print(f"Skipping (not found): {file_path}", file=sys.stderr)
            continue

        if file_path.suffix.lower() != '.appimage':
            print(f"Skipping (not .AppImage): {file_path}", file=sys.stderr)
            continue

        dest_path = APPIMAGE_DIR / file_path.name
        if dest_path.exists():
            if not force:
                print(f"Already installed: {dest_path}. Use --force to overwrite.", file=sys.stderr)
                continue
            dest_path.unlink()

        shutil.copy2(file_path, dest_path)
        make_executable(dest_path)

        link_path = BIN_DIR / dest_path.name
        if link_path.exists() or link_path.is_symlink():
            link_path.unlink()
        link_path.symlink_to(dest_path)

        if not no_desktop:
            entry_name = sanitize_name(dest_path.name)
            desktop_file_path = DESKTOP_DIR / f"{entry_name}.desktop"
            with desktop_file_path.open('w', encoding='utf-8') as f:
                f.write(desktop_file_for(dest_path, entry_name))

        print(f"Installed {dest_path} -> {link_path}")


def uninstall_appimage(name: str, remove_files: bool = True) -> None:
    ensure_dirs()
    if not name.lower().endswith('.appimage'):
        name = name + '.AppImage'

    dest_path = APPIMAGE_DIR / name
    if not dest_path.exists():
        print(f"Not found: {dest_path}", file=sys.stderr)
        return

    installed_name = sanitize_name(name)
    desktop_file_path = DESKTOP_DIR / f"{installed_name}.desktop"
    link_path = BIN_DIR / name

    if link_path.exists() or link_path.is_symlink():
        link_path.unlink()

    if desktop_file_path.exists():
        desktop_file_path.unlink()

    if remove_files:
        dest_path.unlink()

    print(f"Uninstalled {name}")


def list_installed() -> None:
    ensure_dirs()
    entries = sorted(APPIMAGE_DIR.glob('*.AppImage'))
    if not entries:
        print('No AppImages installed in', APPIMAGE_DIR)
        return

    for app in entries:
        print(app.name)


def info_appimage(name: str) -> None:
    ensure_dirs()
    if not name.lower().endswith('.appimage'):
        name = name + '.AppImage'

    app_path = APPIMAGE_DIR / name
    if not app_path.exists():
        print(f"Not found: {app_path}", file=sys.stderr)
        return

    st = app_path.stat()
    print('Path:', app_path)
    print('Size:', st.st_size, 'bytes')
    print('Executable:', os.access(app_path, os.X_OK))
    print('Installed link:', (BIN_DIR / name).resolve() if (BIN_DIR / name).exists() else '(missing)')


def main() -> int:
    parser = argparse.ArgumentParser(description='AppImage installer helper')
    sub = parser.add_subparsers(dest='command', required=True)

    p_install = sub.add_parser('install', help='Install AppImage(s)')
    p_install.add_argument('files', nargs='+', type=Path)
    p_install.add_argument('--force', action='store_true', help='Overwrite existing AppImages')
    p_install.add_argument('--no-desktop', action='store_true', help='Do not create desktop entry')

    p_uninstall = sub.add_parser('uninstall', help='Uninstall an AppImage')
    p_uninstall.add_argument('name', help='AppImage filename or name without extension')

    p_list = sub.add_parser('list', help='List installed AppImages')

    p_info = sub.add_parser('info', help='Show info about installed AppImage')
    p_info.add_argument('name', help='AppImage filename or name without extension')

    args = parser.parse_args()

    if args.command == 'install':
        install_appimages(args.files, force=args.force, no_desktop=args.no_desktop)
    elif args.command == 'uninstall':
        uninstall_appimage(args.name)
    elif args.command == 'list':
        list_installed()
    elif args.command == 'info':
        info_appimage(args.name)
    else:
        parser.print_help()

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
