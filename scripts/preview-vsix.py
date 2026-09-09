#!/usr/bin/env python3
"""
Preview which files would land in the VSIX given the current .vscodeignore
rules. Useful for verifying ignore changes without invoking @vscode/vsce.

Usage:
  python3 scripts/preview-vsix.py [--json]
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import vsixignore

EXTRA_EXCLUDES = {
    "ezimage-1.0.2.vsix",
    "ezimage-dev.vsix",
    # packaging helpers
    "preview-vsix.py",
    "package-vsix.py",
    "vsixignore.py",
}


def main():
    json_mode = "--json" in sys.argv
    files = list(vsixignore.iter_files(extra_excludes=EXTRA_EXCLUDES))
    files.sort()
    total = sum(abs_p.stat().st_size for _, abs_p in files)

    if json_mode:
        out = {
            "total_files": len(files),
            "total_bytes": total,
            "files": [
                {"path": rel, "bytes": abs_p.stat().st_size}
                for rel, abs_p in files
            ],
        }
        print(json.dumps(out, indent=2))
        return

    print(f"Total files: {len(files)}")
    print(f"Total size:  {total / 1024 / 1024:.2f} MB")

    print("\nTop 20 largest files:")
    for rel, abs_p in sorted(files, key=lambda x: -x[1].stat().st_size)[:20]:
        print(f"  {abs_p.stat().st_size/1024:8.1f} KB  {rel}")

    nm_sizes: dict[str, int] = {}
    for rel, abs_p in files:
        if rel.startswith("node_modules/"):
            parts = rel.split("/")
            if parts[1].startswith("@"):
                key = "/".join(parts[:3])
            else:
                key = parts[1]
            nm_sizes[key] = nm_sizes.get(key, 0) + abs_p.stat().st_size
    print("\nBy package under node_modules:")
    for k in sorted(nm_sizes.keys(), key=lambda x: -nm_sizes[x])[:30]:
        print(f"  {nm_sizes[k]/1024:8.1f} KB  {k}")


if __name__ == "__main__":
    main()
