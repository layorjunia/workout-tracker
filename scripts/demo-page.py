#!/usr/bin/env python3
"""Write scratch/demo-dev/index.html: the real index.html with the made-up demo data of
scripts/screenshots/demo.js loaded after app.js, and a fresh cache-busting number on every asset so a
preview can never run old code. For checking the UI in the browser preview or the iOS Simulator's Safari:

    python3 scripts/demo-page.py
    http://localhost:8766/scratch/demo-dev/index.html?view=steps      (view=goals, health, progress, ...)

Start the preview server named workout-app first. Delete scratch/demo-dev when the job is done.
"""
import os, re, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
html = html.replace("<head>", '<head>\n<base href="/">', 1)
stamp = f"dev{int(time.time())}"
html = re.sub(r"\?v=\d+", f"?v={stamp}", html)
html = re.sub(r'(<script src="capacitor-health\.js[^"]*"></script>)', rf'\1\n<script src="/scripts/screenshots/demo.js?v={stamp}"></script>', html, count=1)
assert "screenshots/demo.js" in html, "index.html changed shape: update the replacement in scripts/demo-page.py"
out = os.path.join(ROOT, "scratch", "demo-dev")
os.makedirs(out, exist_ok=True)
open(os.path.join(out, "index.html"), "w", encoding="utf-8").write(html)
print("wrote scratch/demo-dev/index.html")
