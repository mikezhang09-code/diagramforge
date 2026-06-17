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

# --- Rebrand: replace draw.io's marks with DiagramForge's own (assets/brand/) ---
# draw.io is Apache-2.0, which permits modification/redistribution; we swap the
# upstream trademark logo for ours so the served editor carries our branding.
echo "Applying DiagramForge branding ..."
BRAND="$ROOT/assets/brand"
if [ -d "$BRAND" ]; then
  cp -f "$BRAND/favicon.ico" "$DEST/favicon.ico"
  cp -f "$BRAND/logo48.png"  "$DEST/images/drawlogo48.png"
  cp -f "$BRAND/logo48.png"  "$DEST/images/drawlogo48-gray.png"
  cp -f "$BRAND/logo80.png"  "$DEST/images/drawlogo80.png"
  cp -f "$BRAND/logo128.png" "$DEST/images/drawlogo128.png"
  cp -f "$BRAND/logo144.png" "$DEST/images/drawlogo144.png"
  cp -f "$BRAND/logo256.png" "$DEST/images/drawlogo256.png"
  cp -f "$BRAND/logo256.png" "$DEST/images/logo-flat.png"
  cp -f "$BRAND/logo256.png" "$DEST/images/logo-white.png"
  for f in drawlogo.svg drawlogo-color.svg drawlogo-gray.svg drawlogo-text-bottom.svg; do
    cp -f "$BRAND/logo.svg" "$DEST/images/$f"
  done
  sed -i 's#<title>[^<]*</title>#<title>DiagramForge</title>#' "$DEST/index.html"
else
  echo "  (assets/brand not found - skipping rebrand; editor keeps draw.io marks)"
fi

echo "Writing version marker …"
echo "$VERSION" > "$DEST/.drawio-version"

echo "Done: $(du -sh "$DEST" | cut -f1) at public/drawio (draw.io ${VERSION})"
