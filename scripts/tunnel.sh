#!/usr/bin/env bash
# Runs a Cloudflare quick tunnel to the local dev server and, once the public
# URL appears in cloudflared's output, reprints it in a loud, easy-to-spot
# banner. This matters when running under `concurrently` (npm run dev:public),
# where cloudflared's own URL box gets chopped up by log prefixes and buried in
# Next.js compile output.

set -euo pipefail

PORT="${PORT:-3005}"
URL_SHOWN=0

cloudflared tunnel --url "http://localhost:${PORT}" 2>&1 | while IFS= read -r line; do
  # Pass cloudflared's own output through unchanged.
  printf '%s\n' "$line"

  if [ "$URL_SHOWN" -eq 0 ]; then
    public_url="$(printf '%s' "$line" | grep -oE 'https://[a-z0-9.-]+\.trycloudflare\.com' || true)"
    if [ -n "$public_url" ]; then
      URL_SHOWN=1
      printf '\n'
      printf '  ============================================================\n'
      printf '  PUBLIC URL:  %s\n' "$public_url"
      printf '  ============================================================\n\n'
    fi
  fi
done
