#!/bin/bash
# Bump the cache-busting version before a deploy:
#   ?v=<from> -> ?v=<to> in index.html, and VERSION in service-worker.js.
# usage: scripts/bump-version.sh <from> <to>      e.g. scripts/bump-version.sh 66 67
[ $# -eq 2 ] || { echo "usage: $0 <from> <to>"; exit 1; }
cd "$(dirname "$0")/.." || exit 1
sed -i '' "s/?v=$1/?v=$2/g" index.html
sed -i '' "s/const VERSION = \"v$1\"/const VERSION = \"v$2\"/" service-worker.js
echo "index.html: $(grep -F -c -- "?v=$2" index.html) lines with ?v=$2 (7 expected)"
grep -n "VERSION =" service-worker.js
