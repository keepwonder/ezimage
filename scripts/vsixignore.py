"""
Shared helpers for applying .vscodeignore rules and packaging VSIX files
locally (without requiring @vscode/vsce).

VS Code's .vscodeignore rules are gitignore-flavoured:
  - Patterns starting with `!` re-include previously-excluded paths.
  - Patterns ending with `/` are directory-only.
  - `**` matches any number of directory levels.
  - Patterns are evaluated in order; later rules override earlier ones.
"""
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IGNORE_FILE = ROOT / ".vscodeignore"


def parse_patterns(ignore_path: Path = IGNORE_FILE):
    """Parse .vscodeignore into [(negate, pattern, dir_only)] tuples."""
    patterns = []
    for raw in ignore_path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        negate = line.startswith("!")
        if negate:
            line = line[1:]
        patterns.append((negate, line.rstrip("/") if line.endswith("/") else line, raw.endswith("/")))
    return patterns


def _glob_to_regex(pattern: str) -> str:
    """Translate a glob (with ** support) into a regex."""
    regex_parts = []
    i = 0
    while i < len(pattern):
        c = pattern[i]
        if c == "*" and i + 1 < len(pattern) and pattern[i + 1] == "*":
            # `**/...` -> match any prefix (including no prefix)
            if i + 2 < len(pattern) and pattern[i + 2] == "/":
                regex_parts.append("(?:.*/)?")
                i += 3
            else:
                regex_parts.append(".*")
                i += 2
        elif c == "*":
            regex_parts.append("[^/]*")
            i += 1
        elif c == "?":
            regex_parts.append("[^/]")
            i += 1
        elif c in ".+(){}[]|^$\\":
            regex_parts.append("\\" + c)
            i += 1
        else:
            regex_parts.append(c)
            i += 1
    return "".join(regex_parts)


def _matches(path_rel: str, pattern: str, dir_only: bool) -> bool:
    if dir_only and not path_rel.endswith("/"):
        return False
    return re.fullmatch(_glob_to_regex(pattern), path_rel) is not None


def should_include(rel_path: str, is_dir: bool, patterns) -> bool:
    """Apply .vscodeignore rules to determine if a path should be packaged."""
    included = False
    for negate, pat, dir_only in patterns:
        if _matches(rel_path, pat, dir_only):
            included = negate
    return included


def iter_files(patterns=None, extra_excludes=()):
    """Yield (rel_path, abs_path) tuples for every file that would be packaged."""
    if patterns is None:
        patterns = parse_patterns()
    for dirpath, _dirnames, filenames in os.walk(ROOT):
        rel_dir = os.path.relpath(dirpath, ROOT)
        if rel_dir == ".":
            rel_dir = ""
        for name in filenames:
            if name in extra_excludes:
                continue
            abs_p = Path(dirpath) / name
            rel = (Path(rel_dir) / name).as_posix() if rel_dir else name
            if should_include(rel, False, patterns):
                yield rel, abs_p
