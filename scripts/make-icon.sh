#!/bin/bash
# Draw the app icon and install it: the iOS 1024px icon and the web icons (180, 192, 512).
#
#   bash scripts/make-icon.sh
#
# scripts/icon/icon.py draws icon.svg; headless Google Chrome renders it flat (no transparency, as the
# App Store requires); sips makes the smaller sizes. A new native build is needed before the phone or
# the App Store shows the new iOS icon (bash scripts/release.sh --upload, or npm run ios:deploy).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] || { echo "Google Chrome not found (set CHROME=...)"; exit 1; }
python3 -B scripts/icon/icon.py
WORK="$ROOT/scratch/icon-work"; rm -rf "$WORK"; mkdir -p "$WORK"
IOS="ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
"$CHROME" --headless=new --hide-scrollbars --force-device-scale-factor=1 --window-size=1024,1024 \
  --user-data-dir="$WORK/profile" --screenshot="$ROOT/$IOS" "file://$ROOT/scripts/icon/icon.svg" >/dev/null 2>&1
rm -rf "$WORK"; rmdir scratch 2>/dev/null || true
W=$(sips -g pixelWidth "$IOS" | awk '/pixelWidth/ {print $2}'); A=$(sips -g hasAlpha "$IOS" | awk '/hasAlpha/ {print $2}')
[ "$W" = "1024" ] && [ "$A" = "no" ] || { echo "icon is ${W}px, alpha=$A: expected 1024px and no alpha"; exit 1; }
for n in 180 192 512; do sips -z $n $n "$IOS" --out "icon-$n.png" >/dev/null; done
echo "installed: $IOS and icon-180.png, icon-192.png, icon-512.png"
