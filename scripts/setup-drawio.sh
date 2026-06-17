#!/usr/bin/env bash
# Fetch the self-hosted draw.io editor (Apache-2.0) into public/drawio.
#
# The editor is large (~146 MB) and not committed to git — like node_modules,
# it's fetched on setup/deploy. Run this once after cloning, or to upgrade the
# pinned version below.
set -euo pipefail

VERSION="${DRAWIO_VERSION:-v30.0.4}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/public/drawio"
TARBALL="https://github.com/jgraph/drawio/archive/refs/tags/${VERSION}.tar.gz"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Fetching draw.io ${VERSION} …"
curl -fsSL -o "$TMP/drawio.tar.gz" "$TARBALL"

echo "Extracting webapp …"
tar -xzf "$TMP/drawio.tar.gz" -C "$TMP" "drawio-${VERSION#v}/src/main/webapp"

echo "Installing into public/drawio …"
rm -rf "$DEST"
mkdir -p "$ROOT/public"
mv "$TMP/drawio-${VERSION#v}/src/main/webapp" "$DEST"

# Java servlet config — not used when served as static files.
rm -rf "$DEST/WEB-INF" "$DEST/META-INF"

echo "Writing version marker …"
echo "$VERSION" > "$DEST/.drawio-version"

echo "Done: $(du -sh "$DEST" | cut -f1) at public/drawio (draw.io ${VERSION})"
