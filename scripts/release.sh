#!/bin/bash
# Build the Workout Tracker for the App Store: archive, export a signed .ipa, optionally upload it to App Store Connect.
#
#   bash scripts/release.sh --archive-only   # build + archive only (needs no Apple account access)
#   bash scripts/release.sh                  # + export a signed .ipa (run scripts/appstore-profiles.py first)
#   bash scripts/release.sh --upload         # + send it to App Store Connect
#
# Signing is MANUAL against the two profiles scripts/appstore-profiles.py issues through the API key,
# so no Xcode account is needed. Everything lands in ios/build/ (archives, exports, logs): inside the
# project folder. Keys come from scripts/.asc-env (git-ignored) or the environment.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
[ -f scripts/.asc-env ] && . ./scripts/.asc-env

MODE=export
case "${1:-}" in
  --archive-only) MODE=archive ;;
  --upload) MODE=upload ;;
  "") ;;
  *) echo "usage: $0 [--archive-only|--upload]"; exit 1 ;;
esac

STAMP="$(date +%y%m%d-%H%M)"     # names the archive and export folders so they sort by time
# Build number, e.g. 261030.1408: always rises, and each part stays small enough for any Apple limit.
BUILD="$(date +%y%m%d).$((10#$(date +%H) * 100 + 10#$(date +%M)))"
VERSION="${VERSION:-1.0}"        # the version testers see; set VERSION=1.1 for a new release
TEAM=B4U26FR445
ARCHIVES="$ROOT/ios/build/archives"; EXPORTS="$ROOT/ios/build/exports"; LOGS="$ROOT/ios/build/logs"
ARCHIVE="$ARCHIVES/WorkoutTracker-$STAMP.xcarchive"; EXPORT="$EXPORTS/WorkoutTracker-$STAMP"
mkdir -p "$ARCHIVES" "$EXPORTS" "$LOGS"

# Build output, not keepsakes: keep the newest 3 of each.
prune() {
  local n=0 d
  while IFS= read -r d; do
    n=$((n + 1))
    if [ "$n" -gt 3 ]; then rm -rf "$d"; fi
  done < <(ls -1d "$1"/WorkoutTracker-* 2>/dev/null | sort -r)
  return 0
}
prune "$ARCHIVES"; prune "$EXPORTS"

echo "== web -> ios"
npm run cap:sync > "$LOGS/cap-sync.log" 2>&1 || { tail -20 "$LOGS/cap-sync.log"; echo "cap sync failed"; exit 1; }
git diff --quiet -- ios/App/CapApp-SPM/Package.swift || echo "   note: cap sync changed ios/App/CapApp-SPM/Package.swift - check git diff"

echo "== archiving (Release, version $VERSION, build $BUILD)"
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -derivedDataPath ios/build -archivePath "$ARCHIVE" \
  MARKETING_VERSION="$VERSION" CURRENT_PROJECT_VERSION="$BUILD" archive \
  > "$LOGS/archive.log" 2>&1 || {
    grep -E "error:" "$LOGS/archive.log" | head -10
    echo "archive failed - full log: ios/build/logs/archive.log"; exit 1; }
echo "   $ARCHIVE"
[ "$MODE" = archive ] && { echo "done (archive only)"; exit 0; }

AUTH=()
KEY="$HOME/.appstoreconnect/private_keys/AuthKey_${ASC_KEY_ID:-none}.p8"
if [ -n "${ASC_KEY_ID:-}" ] && [ -n "${ASC_ISSUER_ID:-}" ] && [ -f "$KEY" ]; then
  AUTH=(-authenticationKeyPath "$KEY" -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
fi

export_with() {   # $1 = export | upload
  mkdir -p "$EXPORT"
  cat > "$EXPORT/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>$TEAM</string>
  <key>signingStyle</key><string>manual</string>
  <key>signingCertificate</key><string>Apple Distribution</string>
  <key>provisioningProfiles</key><dict>
    <key>com.layorjunia.workouttracker</key><string>Workout Tracker AppStore</string>
    <key>com.layorjunia.workouttracker.widget</key><string>Workout Widget AppStore</string>
  </dict>
  <key>uploadSymbols</key><true/>
  <key>destination</key><string>$1</string>
</dict></plist>
PLIST
  xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportPath "$EXPORT" \
    -exportOptionsPlist "$EXPORT/ExportOptions.plist" ${AUTH[@]+"${AUTH[@]}"} \
    > "$LOGS/export-$1.log" 2>&1 || {
      grep -E "error:|Error" "$LOGS/export-$1.log" | head -10
      echo "$1 failed - full log: ios/build/logs/export-$1.log"; exit 1; }
}

echo "== exporting a signed App Store .ipa"
export_with export
IPA="$(ls "$EXPORT"/*.ipa | head -1)"
echo "   $IPA ($(du -h "$IPA" | cut -f1))"

if [ "$MODE" = upload ]; then
  [ ${#AUTH[@]} -gt 0 ] || { echo "no API key found (ASC_KEY_ID / ASC_ISSUER_ID) - cannot upload"; exit 1; }
  echo "== uploading to App Store Connect"
  export_with upload
  echo "   uploaded - it shows up under the app's Builds in App Store Connect once Apple finishes processing (usually 5-15 minutes)"
fi
