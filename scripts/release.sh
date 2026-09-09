#!/usr/bin/env bash
#
# Release script — bumps version, regenerates CHANGELOG, commits, and tags.
# Intended to be run by a maintainer locally before pushing the tag.
#
# Usage:
#   ./scripts/release.sh patch    # 1.0.2 -> 1.0.3
#   ./scripts/release.sh minor    # 1.0.2 -> 1.1.0
#   ./scripts/release.sh major    # 1.0.2 -> 2.0.0
#   ./scripts/release.sh --dry    # dry run (no changes)
#
# After this script finishes, push the resulting commit and tag:
#   git push && git push --tags
#
# A tag like v1.0.3 will then trigger .github/workflows/release.yml, which
# will package the VSIX and attach it to the GitHub Release automatically.
#
set -euo pipefail

bump="${1:-patch}"

if [ "$bump" = "--dry" ] || [ "$bump" = "--dry-run" ]; then
  echo "==> Dry run — no files will be modified."
  npx standard-version --dry-run
  exit 0
fi

if [ "$bump" != "patch" ] && [ "$bump" != "minor" ] && [ "$bump" != "major" ]; then
  echo "Usage: $0 [patch|minor|major|--dry]" >&2
  exit 1
fi

# Sanity: clean working tree.
if ! git diff --quiet HEAD 2>/dev/null; then
  echo "ERROR: Working tree has uncommitted changes. Commit or stash first." >&2
  exit 1
fi

echo "==> Running standard-version (bump: $bump) ..."
npx standard-version --release-as "$bump"

new_version=$(node -p "require('./package.json').version")
tag="v${new_version}"
echo
echo "==> Done."
echo "    Version: ${new_version}"
echo "    Tag:     ${tag}"
echo
echo "Next steps:"
echo "    git push"
echo "    git push origin ${tag}"
echo
echo "The release workflow will then build the VSIX and publish a GitHub Release."
