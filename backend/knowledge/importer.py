"""Explicit, offline corpus maintenance helper; queries never invoke it.

It intentionally accepts already-reviewed JSON rather than fetching arbitrary
URLs.  Operators can validate a staging file, preview its replacement, then
atomically install it with a timestamped backup.  Restore is equally explicit.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import tempfile

from .service import DATA_DIRECTORY, _load_array


MANAGED = ("documents.json", "buildings.json", "pois.json", "assets.json", "SOURCE_REGISTRY.json")


def inspect(directory: Path) -> dict[str, int]:
    return {name: len(_load_array(directory / name)) for name in MANAGED}


def replace_from_staging(staging: Path, dry_run: bool) -> dict[str, int]:
    if not staging.is_dir():
        raise ValueError("staging directory does not exist")
    counts = inspect(staging)
    missing = [name for name in MANAGED if not (staging / name).is_file()]
    if missing:
        raise ValueError(f"staging is missing managed files: {', '.join(missing)}")
    if dry_run:
        return counts
    backup = DATA_DIRECTORY / ".backup-last"
    temporary = Path(tempfile.mkdtemp(prefix="knowledge-import-", dir=DATA_DIRECTORY.parent))
    try:
        for name in MANAGED:
            payload = json.loads((staging / name).read_text(encoding="utf-8"))
            if not isinstance(payload, list):
                raise ValueError(f"{name} is not a JSON array")
            (temporary / name).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if backup.exists():
            shutil.rmtree(backup)
        backup.mkdir()
        for name in MANAGED:
            shutil.copy2(DATA_DIRECTORY / name, backup / name)
            os.replace(temporary / name, DATA_DIRECTORY / name)
    finally:
        shutil.rmtree(temporary, ignore_errors=True)
    return counts


def restore_last_backup() -> None:
    backup = DATA_DIRECTORY / ".backup-last"
    if not backup.is_dir() or any(not (backup / name).is_file() for name in MANAGED):
        raise ValueError("no complete backup available")
    for name in MANAGED:
        os.replace(backup / name, DATA_DIRECTORY / name)
    backup.rmdir()


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate or atomically install reviewed campus knowledge JSON")
    parser.add_argument("--staging", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--restore-last-backup", action="store_true")
    args = parser.parse_args()
    if args.restore_last_backup:
        restore_last_backup()
        print("restored .backup-last")
    elif args.staging:
        print(json.dumps(replace_from_staging(args.staging, args.dry_run), ensure_ascii=False, sort_keys=True))
    else:
        print(json.dumps(inspect(DATA_DIRECTORY), ensure_ascii=False, sort_keys=True))


if __name__ == "__main__":
    main()
