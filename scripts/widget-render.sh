#!/bin/bash
# Check the Home Screen widget's layout without the phone: renders the real SwiftUI views to PNG on this
# Mac at the exact widget sizes, dark and light, for a set of states (ios/tests/WidgetRender.swift), and
# lays them out in contact sheets.
#
#   scripts/widget-render.sh
#
# Everything lands in scratch/widget-render (git-ignored): <family>_<state>_<dark|light>.png and
# sheet_small.png / sheet_medium.png. Delete the folder when the job is done.
set -euo pipefail
cd "$(dirname "$0")/.."
W=scratch/widget-render
rm -rf "$W" && mkdir -p "$W"
cp ios/App/Shared/StepEngine.swift ios/App/Shared/StepStore.swift "$W/"
# the harness runs outside a widget host: no @main, and the family is a plain property
sed -e '/^@main$/d' -e 's/@Environment(\\.widgetFamily) var family/var family: WidgetFamily = .systemSmall/' \
    ios/App/StreakWidget/StreakWidget.swift > "$W/Widget.swift"
cp ios/tests/WidgetRender.swift "$W/main.swift"
( cd "$W" && swiftc -O -o render StepEngine.swift StepStore.swift Widget.swift main.swift && ./render )
python3 - <<'PY'
import glob, os
from PIL import Image, ImageDraw
W = "scratch/widget-render"
for family in ("small", "medium"):
    names = sorted({os.path.basename(p)[len(family) + 1:-len("_dark.png")] for p in glob.glob(f"{W}/{family}_*_dark.png")})
    if not names:
        continue
    first = Image.open(f"{W}/{family}_{names[0]}_dark.png")
    w, h = first.size
    cols = 2 if family == "medium" else 4
    pad = 24
    cells = [(n, t) for n in names for t in ("dark", "light")]
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (w + pad) + pad, rows * (h + pad + 30) + pad), (30, 30, 34))
    d = ImageDraw.Draw(sheet)
    for i, (n, t) in enumerate(cells):
        x, y = pad + (i % cols) * (w + pad), pad + (i // cols) * (h + pad + 30)
        d.text((x, y), f"{n} {t}", fill=(200, 200, 205))
        sheet.paste(Image.open(f"{W}/{family}_{n}_{t}.png").convert("RGB"), (x, y + 24))
    sheet.save(f"{W}/sheet_{family}.png")
    print("wrote", f"{W}/sheet_{family}.png", sheet.size)
PY
