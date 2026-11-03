#!/usr/bin/env python3
"""Draw the Sets & Steps app icon as scripts/icon/icon.svg: a glowing dumbbell whose plates step down
like stairs, inside a ten-segment counter ring (the same ten steps as the app's medal bar). Colors run
mint (lower left) to blue to violet (upper right). Render and install it with scripts/make-icon.sh.
"""
import math, pathlib

OUT = pathlib.Path(__file__).with_name("icon.svg")


def stepped_barbell(tilt=-12, fit_w=595, fit_h=510, cx=512, cy=516, plates=((100, 420), (188, 320), (276, 220)), pw=70, bar_h=66, bar_half=125, rx=30):
    rects = [dict(x=-bar_half, y=-bar_h / 2, w=2 * bar_half, h=bar_h, rx=bar_h / 2, kind="bar")]
    for x, h in plates:
        rects.append(dict(x=x, y=-h / 2, w=pw, h=h, rx=rx, kind="plate"))
        rects.append(dict(x=-(x + pw), y=-h / 2, w=pw, h=h, rx=rx, kind="plate"))
    a = math.radians(tilt)
    xs, ys = [], []
    for r in rects:
        for px, py in ((r["x"], r["y"]), (r["x"] + r["w"], r["y"]), (r["x"], r["y"] + r["h"]), (r["x"] + r["w"], r["y"] + r["h"])):
            xs.append(px * math.cos(a) - py * math.sin(a)); ys.append(px * math.sin(a) + py * math.cos(a))
    s = min(fit_w / (max(xs) - min(xs)), fit_h / (max(ys) - min(ys)))
    return f"translate({cx} {cy}) rotate({tilt}) scale({s:.4f})", rects


def rects_svg(rects, fill, shine=True):
    out = []
    for r in rects:
        out.append(f'<rect x="{r["x"]}" y="{r["y"]}" width="{r["w"]}" height="{r["h"]}" rx="{r["rx"]}" fill="{fill}"/>')
        if shine and r["kind"] == "plate":
            out.append(f'<rect x="{r["x"] + 10}" y="{r["y"] + 16}" width="11" height="{r["h"] - 32}" rx="5" fill="#ffffff" fill-opacity="0.45"/>')
    return "\n    ".join(out)


def arc(cx, cy, r, a0, a1):
    p = lambda a: (cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a)))
    (x0, y0), (x1, y1) = p(a0), p(a1)
    return f"M{x0:.1f} {y0:.1f} A{r} {r} 0 0 1 {x1:.1f} {y1:.1f}"


def lerp(c0, c1, t):
    a = [int(c0[i:i + 2], 16) for i in (1, 3, 5)]; b = [int(c1[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(a[i] + (b[i] - a[i]) * t):02x}" for i in range(3))


LIT, R, W = 7, 352, 54                      # seven of the ten steps lit
cols = [lerp("#7a8dff", "#34e3b2", i / (LIT - 1)) for i in range(LIT)]
dim, lit = [], []
for i in range(10):
    d = arc(512, 512, R, -90 + i * 36 + 8, -90 + i * 36 + 28)
    dim.append(f'<path d="{d}" stroke="#232f55" stroke-width="{W}" stroke-linecap="round" fill="none"/>')
    if i < LIT:
        lit.append(f'<path d="{d}" stroke="{cols[i]}" stroke-width="{W}" stroke-linecap="round" fill="none"/>')
tf, rects = stepped_barbell()
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="0.5" cy="0.32" r="0.95"><stop offset="0" stop-color="#1d2f69"/><stop offset="0.55" stop-color="#0d1430"/><stop offset="1" stop-color="#06080f"/></radialGradient>
    <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="-330" y1="210" x2="330" y2="-210"><stop offset="0" stop-color="#34e3b2"/><stop offset="0.5" stop-color="#4fb4ff"/><stop offset="1" stop-color="#7a8dff"/></linearGradient>
    <filter id="glowD" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="30"/></filter>
    <filter id="glowR" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="16"/></filter>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <g>{"".join(dim)}</g>
  <g opacity="0.55" filter="url(#glowR)">{"".join(lit)}</g>
  <g>{"".join(lit)}</g>
  <g transform="{tf}" filter="url(#glowD)" opacity="0.6">
    {rects_svg(rects, "url(#g)", shine=False)}
  </g>
  <g transform="{tf}">
    {rects_svg(rects, "url(#g)")}
  </g>
</svg>
'''
OUT.write_text(svg)
print("wrote", OUT)
