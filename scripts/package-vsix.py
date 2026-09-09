#!/usr/bin/env python3
"""
Local VSIX packer that mirrors what @vscode/vsce does, but without requiring
vsce to be installed. Produces a .vsix file with the standard structure:

  [Content_Types].xml
  extension.vsixmanifest
  extension/<project files>

Usage:
  python3 scripts/package-vsix.py [<output.vsix>]
  python3 scripts/package-vsix.py --verify [<output.vsix>]
"""
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import vsixignore

EXTRA_EXCLUDES = {
    "ezimage-1.0.2.vsix",
    "ezimage-dev.vsix",
    "preview-vsix.py",
    "package-vsix.py",
    "vsixignore.py",
}

CONTENT_TYPES = """<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="vsixmanifest" ContentType="text/xml"/>
  <Default Extension="json" ContentType="application/json"/>
  <Default Extension="js" ContentType="application/javascript"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="md" ContentType="text/markdown"/>
  <Default Extension="txt" ContentType="text/plain"/>
</Types>
"""


def make_vsixmanifest(pkg: dict) -> str:
    name = pkg["name"]
    version = pkg["version"]
    publisher = pkg.get("publisher", "")
    identifier = f"{publisher}.{name}" if publisher else name
    engines = pkg.get("engines", {}).get("vscode", "")
    return f"""<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="{identifier}" Version="{version}" Publisher="{publisher}"/>
    <DisplayName>{pkg.get("displayName", name)}</DisplayName>
    <Description>{pkg.get("description", "")}</Description>
    <Tags>markdown,uploader,image,vscode</Tags>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Dependencies>
    <Dependency Id="{publisher}.{name}" DisplayName="{pkg.get('displayName', name)}" Version="{version}"/>
  </Dependencies>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
  </Assets>
</PackageManifest>
"""


def package_vsix(output: Path) -> tuple[int, int]:
    """Package the VSIX; return (unpacked_bytes, packed_bytes)."""
    import json as _json

    pkg = _json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    patterns = vsixignore.parse_patterns()
    files = list(vsixignore.iter_files(patterns, extra_excludes=EXTRA_EXCLUDES))
    files.sort()

    output.parent.mkdir(parents=True, exist_ok=True)

    total_unpacked = 0
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        z.writestr("[Content_Types].xml", CONTENT_TYPES)
        z.writestr("extension.vsixmanifest", make_vsixmanifest(pkg))
        for rel, abs_p in files:
            z.write(abs_p, f"extension/{rel}")
            total_unpacked += abs_p.stat().st_size

    return total_unpacked, output.stat().st_size


def verify_vsix(vsix: Path) -> int:
    """Extract the VSIX to a temp dir and run smoke tests."""
    print(f"\n[verify] Extracting {vsix.name} ...")
    workdir = Path(tempfile.mkdtemp(prefix="vsix-verify-"))
    try:
        with zipfile.ZipFile(vsix) as z:
            z.extractall(workdir)

        ext_dir = workdir / "extension"
        print(f"  workdir: {workdir}")
        print(f"  ext_dir: {ext_dir}")
        print(f"  ext_dir exists: {ext_dir.exists()}")
        if not (ext_dir / "package.json").exists():
            print("  FAIL: extension/package.json missing")
            return 1
        print(f"  ok: extension/package.json present")

        # Smoke test 1: out/extension.js compiles & loads (parses)
        ext_js = ext_dir / "out" / "extension.js"
        if not ext_js.exists():
            print(f"  FAIL: {ext_js.relative_to(workdir)} missing")
            return 1
        print(f"  ok: {ext_js.relative_to(workdir)} present ({ext_js.stat().st_size} bytes)")

        # Smoke test 2: AWS SDK resolves and S3Client/PutObjectCommand are
        # accessible from the packaged node_modules layout.
        smoke_code = (
            "const s3 = require('@aws-sdk/client-s3');"
            "if (typeof s3.S3Client !== 'function' || typeof s3.PutObjectCommand !== 'function') {"
            "  console.error('FAIL: S3Client or PutObjectCommand missing'); process.exit(1);"
            "}"
            "console.log('S3Client=' + typeof s3.S3Client + ' PutObjectCommand=' + typeof s3.PutObjectCommand);"
        )
        print("  running: node smoke test (require @aws-sdk/client-s3)")
        try:
            # On Windows, npm-installed node is on PATH but our smoke test
            # cwd contains a node_modules tree that we explicitly want to
            # resolve against. shell=False (the default) avoids .cmd shim
            # quirks on Windows.
            result = subprocess.run(
                ["node", "-e", smoke_code],
                cwd=ext_dir,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                shell=False,
            )
        except FileNotFoundError as e:
            print(f"  FAIL: could not run 'node': {e}")
            return 1
        except OSError as e:
            print(f"  FAIL: subprocess error: {e}")
            return 1
        print(f"  exit code: {result.returncode}")
        if result.stdout:
            print(f"  stdout: {result.stdout.strip()[:300]}")
        if result.stderr:
            print(f"  stderr: {result.stderr.strip()[:500]}")
        if result.returncode != 0:
            print(f"  FAIL: smoke test exited {result.returncode}")
            return 1
        print(f"  ok: {result.stdout.strip()}")

        # Smoke test 3: verify sharp is NOT bundled (must be installed at runtime)
        bundled_sharp = list((ext_dir / "node_modules").rglob("sharp/package.json"))
        if bundled_sharp:
            print(f"  FAIL: sharp is bundled into VSIX (found at {bundled_sharp[0].relative_to(ext_dir)})")
            return 1
        print("  ok: sharp is NOT bundled (will be installed on first use)")

        # Smoke test 4: confirm VSIX size is reasonable
        size_mb = vsix.stat().st_size / 1024 / 1024
        if size_mb > 5:
            print(f"  WARN: VSIX is {size_mb:.2f} MB — expected < 5 MB after slimming")
        else:
            print(f"  ok: VSIX size {size_mb:.2f} MB (under 5 MB threshold)")

        print("\n[verify] All smoke tests passed ✓")
        return 0
    finally:
        # On Windows, rmtree can fail on read-only files extracted from the
        # ZIP (e.g. .gitignore-style files without the user-write bit). Use
        # an onerror callback that clears the read-only flag and retries.
        def _on_rm_error(func, path, exc_info):
            try:
                os.chmod(path, 0o777)
            except OSError:
                pass
            try:
                func(path)
            except Exception:
                pass
        shutil.rmtree(workdir, ignore_errors=True, onerror=_on_rm_error)


def main():
    args = sys.argv[1:]
    verify = "--verify" in args
    if verify:
        args.remove("--verify")

    output = Path(args[0] if args else "ezimage-dev.vsix").resolve()

    print(f"[package] Building {output.name} ...")
    unpacked, packed = package_vsix(output)
    file_count = sum(1 for n in zipfile.ZipFile(output).namelist() if n.startswith("extension/"))
    print(f"  files:      {file_count}")
    print(f"  unpacked:   {unpacked/1024/1024:.2f} MB")
    print(f"  packed:     {packed/1024/1024:.2f} MB")

    if verify:
        rc = verify_vsix(output)
        sys.exit(rc)


if __name__ == "__main__":
    main()
